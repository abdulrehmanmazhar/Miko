import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull, lte, max, or } from "drizzle-orm";
import { database } from "../../services/database.js";
import {
  batchPrices,
  contacts,
  currencies,
  inventoryMovements,
  journalEntries,
  journalLines,
  products,
  salesInvoiceLines,
  salesInvoices,
  stock,
  users,
  batches,
  warehouses,
} from "../../schema/tables.js";
import { pushActionContext } from "../../utils/action_recorder/index.js";
import { requireActiveAccount } from "../../utils/database/sale_accounts.js";
import {
  parseSaleInput,
  type PreparedSaleLine,
} from "../../utils/database/sale_input.js";

export default async function* recordSale(
  rawInput: unknown,
): AsyncGenerator<
  { progress: number; message: string; error?: Error; data?: unknown },
  void,
  unknown
> {
  yield { progress: 0, message: "Validating sale" };
  const input = parseSaleInput(rawInput);
  const operationId = randomUUID();
  const now = new Date();

  const result = database.transaction((tx) => {
    pushActionContext(tx, operationId, "normal");

    const duplicateInvoice = tx
      .select({ id: salesInvoices.id })
      .from(salesInvoices)
      .where(eq(salesInvoices.invoiceNumber, input.invoiceNumber))
      .limit(1)
      .get();
    if (duplicateInvoice) {
      throw new Error(`Invoice number "${input.invoiceNumber}" is already in use.`);
    }

    const customer = tx
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.id, input.customerId),
          eq(contacts.isActive, true),
          isNull(contacts.deletedAt),
        ),
      )
      .limit(1)
      .get();
    if (!customer || (customer.type !== "customer" && customer.type !== "both")) {
      throw new Error("Customer was not found or is not an active customer.");
    }
    if (!customer.receivableAccountId) {
      throw new Error("Customer must have a receivable account assigned.");
    }
    requireActiveAccount(
      tx,
      customer.receivableAccountId,
      "asset",
      "Customer receivable",
    );

    const currency = tx
      .select({ id: currencies.id })
      .from(currencies)
      .where(and(eq(currencies.id, input.currencyId), isNull(currencies.deletedAt)))
      .limit(1)
      .get();
    if (!currency) throw new Error("Currency was not found or is deleted.");

    const user = tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, input.createdBy), isNull(users.deletedAt)))
      .limit(1)
      .get();
    if (!user) throw new Error("Created-by user was not found or is deleted.");

    const preparedLines: PreparedSaleLine[] = [];
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    let invoiceTotal = 0;
    let costTotal = 0;

    for (const line of input.lines) {
      const product = tx
        .select()
        .from(products)
        .where(
          and(
            eq(products.id, line.productId),
            eq(products.isActive, true),
            isNull(products.deletedAt),
          ),
        )
        .limit(1)
        .get();
      if (!product) {
        throw new Error(`Product "${line.productId}" was not found or is inactive.`);
      }

      if (
        !product.salesAccountId ||
        !product.inventoryAccountId ||
        !product.cogsAccountId
      ) {
        throw new Error(
          `Product "${product.name}" must have sales, inventory, and COGS accounts assigned.`,
        );
      }
      requireActiveAccount(tx, product.salesAccountId, "income", "Sales");
      requireActiveAccount(
        tx,
        product.inventoryAccountId,
        "asset",
        "Inventory",
      );
      requireActiveAccount(tx, product.cogsAccountId, "expense", "COGS");

      const batch = tx
        .select()
        .from(batches)
        .where(
          and(
            eq(batches.id, line.batchId),
            eq(batches.productId, product.id),
            isNull(batches.deletedAt),
          ),
        )
        .limit(1)
        .get();
      if (!batch) {
        throw new Error(
          `Batch "${line.batchId}" does not belong to product "${product.id}" or is deleted.`,
        );
      }
      const applicablePrices = tx
        .select()
        .from(batchPrices)
        .where(
          and(
            eq(batchPrices.batchId, batch.id),
            lte(batchPrices.validFrom, new Date(input.date)),
            or(
              isNull(batchPrices.validTo),
              gt(batchPrices.validTo, new Date(input.date)),
            ),
            isNull(batchPrices.deletedAt),
          ),
        )
        .all();
      if (applicablePrices.length !== 1) {
        throw new Error(
          `Expected one active price for batch "${batch.id}" on the sale date, found ${applicablePrices.length}.`,
        );
      }
      const batchPrice = applicablePrices[0]!;
      if (!Number.isSafeInteger(batchPrice.tax) || batchPrice.tax < 0) {
        throw new Error(`Batch "${batch.id}" has an invalid tax amount.`);
      }

      const warehouse = tx
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(
          and(
            eq(warehouses.id, line.warehouseId),
            isNull(warehouses.deletedAt),
          ),
        )
        .limit(1)
        .get();
      if (!warehouse) {
        throw new Error(`Warehouse "${line.warehouseId}" was not found or is deleted.`);
      }

      const stockRows = tx
        .select()
        .from(stock)
        .where(
          and(
            eq(stock.batchId, batch.id),
            eq(stock.productId, product.id),
            eq(stock.warehouseId, line.warehouseId),
            isNull(stock.validTo),
            isNull(stock.deletedAt),
          ),
        )
        .all();
      if (stockRows.length !== 1) {
        throw new Error(
          `Expected one active stock row for batch "${batch.id}" in warehouse "${line.warehouseId}", found ${stockRows.length}.`,
        );
      }
      const stockRow = stockRows[0]!;
      if (stockRow.totalQuantity < line.quantity) {
        throw new Error(
          `Insufficient stock for product "${product.name}" in warehouse "${line.warehouseId}".`,
        );
      }
      if (batch.costPrice < 0) {
        throw new Error(`Batch "${batch.id}" has an invalid negative cost.`);
      }

      const gross = line.quantity * line.unitPrice;
      const net = gross - line.discount;
      const lineTax = batchPrice.tax * line.quantity;
      if (!Number.isSafeInteger(gross) || line.discount > gross) {
        throw new Error(
          `Discount for product "${product.name}" cannot exceed its line amount.`,
        );
      }
      if (!Number.isSafeInteger(lineTax)) {
        throw new Error(`Tax for product "${product.name}" is too large.`);
      }
      if (lineTax > 0) {
        if (!customer.taxAccountId) {
          throw new Error("Customer must have a tax liability account assigned.");
        }
        requireActiveAccount(
          tx,
          customer.taxAccountId,
          "liability",
          "Customer tax liability",
        );
      }
      const lineTotal = net + lineTax;
      const lineCost = line.quantity * batch.costPrice;
      if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(lineCost)) {
        throw new Error(`Sale amounts for product "${product.name}" are too large.`);
      }

      subtotal += gross;
      discountTotal += line.discount;
      taxTotal += lineTax;
      invoiceTotal += lineTotal;
      costTotal += lineCost;
      if (
        !Number.isSafeInteger(subtotal) ||
        !Number.isSafeInteger(discountTotal) ||
        !Number.isSafeInteger(taxTotal) ||
        !Number.isSafeInteger(invoiceTotal) ||
        !Number.isSafeInteger(costTotal)
      ) {
        throw new Error("Sale totals exceed the supported integer amount.");
      }

      preparedLines.push({
        ...line,
        discount: line.discount,
        tax: lineTax,
        lineSubtotal: net,
        lineTotal,
        unitCost: batch.costPrice,
        stockId: stockRow.id,
        stockQuantity: stockRow.totalQuantity,
        salesAccountId: product.salesAccountId,
        inventoryAccountId: product.inventoryAccountId,
        cogsAccountId: product.cogsAccountId,
      });
    }

    const stockDeductions = new Map<
      string,
      { stockId: string; currentQuantity: number; quantity: number }
    >();
    for (const line of preparedLines) {
      const deduction = stockDeductions.get(line.stockId);
      if (deduction) {
        deduction.quantity += line.quantity;
      } else {
        stockDeductions.set(line.stockId, {
          stockId: line.stockId,
          currentQuantity: line.stockQuantity,
          quantity: line.quantity,
        });
      }
    }
    for (const deduction of stockDeductions.values()) {
      if (deduction.quantity > deduction.currentQuantity) {
        throw new Error("Insufficient stock for the combined sale quantities.");
      }
    }

    if (invoiceTotal <= 0) throw new Error("Sale total must be greater than zero.");

    const numberRow = tx
      .select({ value: max(journalEntries.entryNumber) })
      .from(journalEntries)
      .get();
    const entryNumber = (numberRow?.value ?? 0) + 1;
    if (!Number.isSafeInteger(entryNumber)) {
      throw new Error("Could not allocate a valid journal entry number.");
    }

    const journalEntry = tx
      .insert(journalEntries)
      .values({
        entryNumber,
        date: new Date(input.date),
        description: input.description ?? `Sale invoice ${input.invoiceNumber}`,
        status: "posted",
        postedAt: now,
        createdBy: input.createdBy,
      })
      .returning()
      .get();
    if (!journalEntry) throw new Error("Could not create the sale journal entry.");

    const invoice = tx
      .insert(salesInvoices)
      .values({
        invoiceNumber: input.invoiceNumber,
        customerId: input.customerId,
        date: new Date(input.date),
        status: "posted",
        subtotal,
        discount: discountTotal,
        tax: taxTotal,
        total: invoiceTotal,
        dueDate: new Date(input.dueDate),
        currencyId: input.currencyId,
        journalEntryId: journalEntry.id,
      })
      .returning()
      .get();
    if (!invoice) throw new Error("Could not create the sale invoice.");

    const invoiceLineRows = tx
      .insert(salesInvoiceLines)
      .values(
        preparedLines.map((line) => ({
          invoiceId: invoice.id,
          productId: line.productId,
          description: line.description ?? null,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.discount,
          tax: line.tax,
          total: line.lineTotal,
        })),
      )
      .returning()
      .all();

    for (const deduction of stockDeductions.values()) {
      const updatedStock = tx
        .update(stock)
        .set({
          totalQuantity: deduction.currentQuantity - deduction.quantity,
          updatedAt: now,
        })
        .where(
          and(
            eq(stock.id, deduction.stockId),
            eq(stock.totalQuantity, deduction.currentQuantity),
            isNull(stock.validTo),
            isNull(stock.deletedAt),
          ),
        )
        .returning({ id: stock.id })
        .get();
      if (!updatedStock) {
        throw new Error(
          `Stock row "${deduction.stockId}" changed while processing the sale.`,
        );
      }
    }

    const journalLineValues: (typeof journalLines.$inferInsert)[] = [
      {
        journalEntryId: journalEntry.id,
        accountId: customer.receivableAccountId,
        description: `Receivable - ${input.invoiceNumber}`,
        debit: invoiceTotal,
        credit: 0,
        contactId: customer.id,
      },
    ];

    for (const line of preparedLines) {
      const revenue = line.lineSubtotal;
      const cost = line.quantity * line.unitCost;
      if (revenue > 0) {
        journalLineValues.push({
          journalEntryId: journalEntry.id,
          accountId: line.salesAccountId,
          description: line.description ?? `Sale - ${line.productId}`,
          debit: 0,
          credit: revenue,
          contactId: customer.id,
          productId: line.productId,
        });
      }
      if (line.tax > 0) {
        if (!customer.taxAccountId) {
          throw new Error(
            "Customer must have a tax liability account assigned.",
          );
        }
        journalLineValues.push({
          journalEntryId: journalEntry.id,
          accountId: customer.taxAccountId,
          description: `Tax - ${line.productId}`,
          debit: 0,
          credit: line.tax,
          contactId: customer.id,
          productId: line.productId,
        });
      }
      if (cost > 0) {
        journalLineValues.push(
          {
            journalEntryId: journalEntry.id,
            accountId: line.cogsAccountId,
            description: `COGS - ${line.productId}`,
            debit: cost,
            credit: 0,
            productId: line.productId,
          },
          {
            journalEntryId: journalEntry.id,
            accountId: line.inventoryAccountId,
            description: `Inventory issued - ${line.productId}`,
            debit: 0,
            credit: cost,
            productId: line.productId,
          },
        );
      }

      tx.insert(inventoryMovements)
        .values({
          productId: line.productId,
          batchId: line.batchId,
          warehouseId: line.warehouseId,
          type: "sale",
          quantityDelta: -line.quantity,
          unitCost: line.unitCost,
          occurredAt: new Date(input.date),
        })
        .run();
    }

    const journalLinesResult = tx
      .insert(journalLines)
      .values(journalLineValues)
      .returning()
      .all();

    return {
      operationId,
      invoice,
      invoiceLines: invoiceLineRows,
      journalEntry,
      journalLines: journalLinesResult,
    };
  });

  yield {
    progress: 100,
    message: "Sale completed and posted",
    data: result,
  };
}
