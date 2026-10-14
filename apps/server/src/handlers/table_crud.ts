import { getTableColumns, isNull } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import {
  accounts,
  actionRecords,
  batchPrices,
  batches,
  categories,
  contacts,
  currencies,
  customerPaymentAllocation,
  customerPayments,
  inventoryMovements,
  journalEntries,
  journalLines,
  products,
  salesInvoiceLines,
  salesInvoices,
  settings,
  stock,
  units,
  users,
  warehouses,
} from "../schema/tables.js";
import { channel } from "../services/channel.js";
import { database } from "../services/database.js";
import { isPaginationData } from "../types/schema.js";
import type { MutableTableName } from "../utils/database/mutable_tables.js";
import {
  type TableMutationOperation,
  type TableMutationTaskArgs,
} from "../utils/database/mutate_table.js";
import { getPaginatedTable } from "../utils/database/get_paginated_table.js";
import { databaseTaskManager } from "../utils/task_manager/index.js";

type MutationTaskName =
  | "create_table_row"
  | "update_table_row"
  | "soft_delete_table_row"
  | "hard_delete_table_row";

const taskNames: Record<TableMutationOperation, MutationTaskName> = {
  create: "create_table_row",
  update: "update_table_row",
  soft_delete: "soft_delete_table_row",
  hard_delete: "hard_delete_table_row",
};

type HandlerOptions = {
  eventName: string;
  collectionKey: string;
  readAliases?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function runMutation(
  operation: TableMutationOperation,
  tableName: MutableTableName,
  data: unknown,
) {
  if (!isRecord(data)) throw new Error("Payload must be an object.");

  const taskArgs: TableMutationTaskArgs = { tableName, operation };
  if (operation === "create") {
    const values =
      "values" in data && isRecord(data.values) ? data.values : data;
    taskArgs.values = values;
  } else {
    if (typeof data.id !== "string" || data.id.length === 0) {
      throw new Error("Payload must contain a non-empty id.");
    }
    taskArgs.id = data.id;

    if (operation === "update") {
      if (!isRecord(data.values)) {
        throw new Error("Update payload must contain a values object.");
      }
      taskArgs.values = data.values;
    }
  }

  const task = await databaseTaskManager.initiateTask(
    taskNames[operation],
    taskArgs,
  );
  return task.getData() as Promise<{ operationId: string; record: unknown }>;
}

function registerTableHandlers<TTable extends SQLiteTable>(
  tableName: MutableTableName,
  table: TTable,
  options: HandlerOptions,
) {
  const getHandler = async (data: unknown) => {
    try {
      if (!isPaginationData(data)) {
        throw new Error("Payload does not contain pagination data.");
      }

      const { pageNumber, rowsPerPage } = data;
      if (
        !Number.isInteger(pageNumber) ||
        pageNumber < 1 ||
        !Number.isInteger(rowsPerPage) ||
        rowsPerPage < 1
      ) {
        throw new RangeError(
          "pageNumber and rowsPerPage must be positive integers.",
        );
      }

      const deletedAtColumn = getTableColumns(table).deletedAt;
      const query = database.select().from(table);
      const rows = deletedAtColumn
        ? await query
            .where(isNull(deletedAtColumn))
            .limit(rowsPerPage)
            .offset((pageNumber - 1) * rowsPerPage)
        : await query
            .limit(rowsPerPage)
            .offset((pageNumber - 1) * rowsPerPage);

      return { success: true, [options.collectionKey]: rows };
    } catch (error) {
      return { success: false, error };
    }
  };

  for (const eventName of [options.eventName, ...(options.readAliases ?? [])]) {
    channel?.handle(`${eventName}.get`, getHandler);
  }

  const operations: TableMutationOperation[] = [
    "create",
    "update",
    "soft_delete",
    "hard_delete",
  ];

  for (const operation of operations) {
    channel?.handle(`${options.eventName}.${operation}`, async (data: unknown) => {
      try {
        const result = await runMutation(operation, tableName, data);
        return {
          success: true,
          operationId: result.operationId,
          record: result.record,
        };
      } catch (error) {
        return { success: false, error };
      }
    });
  }
}

registerTableHandlers("users", users, {
  eventName: "users",
  collectionKey: "users",
});
registerTableHandlers("categories", categories, {
  eventName: "categories",
  collectionKey: "categories",
  readAliases: ["catgories"],
});
registerTableHandlers("units", units, {
  eventName: "units",
  collectionKey: "units",
});
registerTableHandlers("warehouses", warehouses, {
  eventName: "warehouses",
  collectionKey: "warehouses",
});
registerTableHandlers("currencies", currencies, {
  eventName: "currencies",
  collectionKey: "currencies",
});
registerTableHandlers("products", products, {
  eventName: "products",
  collectionKey: "products",
});
registerTableHandlers("batches", batches, {
  eventName: "batches",
  collectionKey: "batches",
});
registerTableHandlers("batchPrices", batchPrices, {
  eventName: "batch_prices",
  collectionKey: "batchPrices",
});
registerTableHandlers("stock", stock, {
  eventName: "stock",
  collectionKey: "stock",
});
registerTableHandlers("inventoryMovements", inventoryMovements, {
  eventName: "inventory_movements",
  collectionKey: "inventoryMovements",
});
registerTableHandlers("accounts", accounts, {
  eventName: "accounts",
  collectionKey: "accounts",
});
registerTableHandlers("contacts", contacts, {
  eventName: "contacts",
  collectionKey: "contacts",
});
registerTableHandlers("journalEntries", journalEntries, {
  eventName: "journal_entries",
  collectionKey: "journalEntries",
});
registerTableHandlers("journalLines", journalLines, {
  eventName: "journal_lines",
  collectionKey: "journalLines",
});
registerTableHandlers("salesInvoices", salesInvoices, {
  eventName: "sales_invoices",
  collectionKey: "salesInvoices",
});
registerTableHandlers("salesInvoiceLines", salesInvoiceLines, {
  eventName: "sales_invoice_lines",
  collectionKey: "salesInvoiceLines",
});
registerTableHandlers("customerPayments", customerPayments, {
  eventName: "customer_payments",
  collectionKey: "customerPayments",
});
registerTableHandlers("customerPaymentAllocation", customerPaymentAllocation, {
  eventName: "customer_payment_allocations",
  collectionKey: "customerPaymentAllocations",
});
registerTableHandlers("settings", settings, {
  eventName: "settings",
  collectionKey: "settings",
});

channel?.handle("action_records.get", async (data: unknown) => {
  try {
    if (!isPaginationData(data)) {
      throw new Error("Payload does not contain pagination data");
    }
    const productRes = await getPaginatedTable(
      actionRecords,
      data.pageNumber,
      data.rowsPerPage,
    );
    return { success: true, products: productRes };
  } catch (error) {
    return { success: false, error };
  }
});

channel?.handle("action_records.undo", async (data: unknown) => {
  try {
    if (
      !(
        typeof data === "object" &&
        data !== null &&
        "operationId" in data &&
        typeof data.operationId === "string"
      )
    ) {
      throw new Error("Payload does not contain operationId");
    }
    const undoTask = await databaseTaskManager.initiateTask("undo_actions", {
      operationId: data.operationId,
    });
    const undoData = await undoTask.getData();
    return { success: true, operationId: undoData.undoOperationId };
  } catch (error) {
    return { success: false, error };
  }
});

channel?.handle("action_records.redo", async (data: unknown) => {
  try {
    if (
      !(
        typeof data === "object" &&
        data !== null &&
        "operationId" in data &&
        typeof data.operationId === "string"
      )
    ) {
      throw new Error("Payload does not contain operationId");
    }
    const redoTask = await databaseTaskManager.initiateTask("redo_actions", {
      operationId: data.operationId,
    });
    const redoData = await redoTask.getData();
    return { success: true, operationId: redoData.redoOperationId };
  } catch (error) {
    return { success: false, error };
  }
});
