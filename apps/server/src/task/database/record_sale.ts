import { randomUUID } from "node:crypto";
import { and, eq, isNull, max } from "drizzle-orm";
import { database } from "../../services/database.js";
import {
  accounts,
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

type SaleLineInput = {
  productId: string;
  batchId: string;
  warehouseId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  taxAccountId?: string;
  description?: string;
};

type SaleInput = {
  invoiceNumber: string;
  customerId: string;
  date: number;
  dueDate: number;
  currencyId: string;
  createdBy: string;
  lines: SaleLineInput[];
  description?: string;
};

type PreparedLine = SaleLineInput & {
  discount: number;
  tax: number;
  lineSubtotal: number;
  lineTotal: number;
  unitCost: number;
  stockId: string;
  stockQuantity: number;
  salesAccountId: string;
  inventoryAccountId: string;
  cogsAccountId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function requireInteger(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(`${field} must be a non-negative safe integer.`);
  }
  return value;
}

function requireTimestamp(value: unknown, field: string): number {
  const timestamp = requireInteger(value, field);
  if (Number.isNaN(new Date(timestamp).getTime())) {
    throw new Error(`${field} must be a valid Unix timestamp in milliseconds.`);
  }
  return timestamp;
}

function parseSaleInput(data: unknown): SaleInput {
  if (!isRecord(data)) throw new Error("Sale payload must be an object.");
  if (!Array.isArray(data.lines) || data.lines.length === 0) {
    throw new Error("A sale must contain at least one line.");
  }

  const lines = data.lines.map((value, index): SaleLineInput => {
    const prefix = `lines[${index}]`;
    if (!isRecord(value)) throw new Error(`${prefix} must be an object.`);

    const line: SaleLineInput = {
      productId: requireString(value.productId, `${prefix}.productId`),
      batchId: requireString(value.batchId, `${prefix}.batchId`),
      warehouseId: requireString(value.warehouseId, `${prefix}.warehouseId`),
      quantity: requireInteger(value.quantity, `${prefix}.quantity`),
      unitPrice: requireInteger(value.unitPrice, `${prefix}.unitPrice`),
      discount:
        value.discount === undefined
          ? 0
          : requireInteger(value.discount, `${prefix}.discount`),
      tax:
        value.tax === undefined
          ? 0
          : requireInteger(value.tax, `${prefix}.tax`),
    };
    if (line.quantity < 1) {
      throw new Error(`${prefix}.quantity must be greater than zero.`);
    }
    if (value.taxAccountId !== undefined) {
      line.taxAccountId = requireString(
        value.taxAccountId,
        `${prefix}.taxAccountId`,
      );
    }
    if (value.description !== undefined) {
      if (typeof value.description !== "string") {
        throw new Error(`${prefix}.description must be a string.`);
      }
      line.description = value.description;
    }
    if (line.tax > 0 && !line.taxAccountId) {
      throw new Error(
        `${prefix}.taxAccountId is required when tax is greater than zero.`,
      );
    }
    return line;
  });

  const date = requireTimestamp(data.date, "date");
  const dueDate = requireTimestamp(data.dueDate, "dueDate");
  if (dueDate < date) {
    throw new Error("dueDate cannot be earlier than the sale date.");
  }

  return {
    invoiceNumber: requireString(data.invoiceNumber, "invoiceNumber"),
    customerId: requireString(data.customerId, "customerId"),
    date,
    dueDate,
    currencyId: requireString(data.currencyId, "currencyId"),
    createdBy: requireString(data.createdBy, "createdBy"),
    lines,
    ...(data.description === undefined
      ? {}
      : { description: requireString(data.description, "description") }),
  };
}

function requireActiveAccount(
  tx: Parameters<Parameters<typeof database.transaction>[0]>[0],
  accountId: string,
  expectedType: (typeof accounts.$inferSelect)["type"],
  label: string,
) : void {
  const account = tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.type, expectedType),
        eq(accounts.isActive, true),
        eq(accounts.isGroup, false),
        isNull(accounts.deletedAt),
      ),
    )
    .limit(1)
    .get();

  if (!account) {
    throw new Error(
      `${label} account "${accountId}" must be an active, non-group ${expectedType} account.`,
    );
  }
}

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

    const preparedLines: PreparedLine[] = [];
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

      if (line.taxAccountId) {
        requireActiveAccount(
          tx,
          line.taxAccountId,
          "liability",
          "Tax liability",
        );
      }

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
      if (!Number.isSafeInteger(gross) || line.discount > gross) {
        throw new Error(
          `Discount for product "${product.name}" cannot exceed its line amount.`,
        );
      }
      const lineTotal = net + line.tax;
      const lineCost = line.quantity * batch.costPrice;
      if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(lineCost)) {
        throw new Error(`Sale amounts for product "${product.name}" are too large.`);
      }

      subtotal += gross;
      discountTotal += line.discount;
      taxTotal += line.tax;
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
        tax: line.tax,
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
        if (!line.taxAccountId) {
          throw new Error(
            `Tax account is required for the tax on product "${line.productId}".`,
          );
        }
        journalLineValues.push({
          journalEntryId: journalEntry.id,
          accountId: line.taxAccountId,
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
