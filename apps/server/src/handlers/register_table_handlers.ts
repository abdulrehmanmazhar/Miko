import { getTableColumns, isNull } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { database } from "../services/database.js";
import { channel } from "../services/channel.js";
import { isPaginationData } from "../types/schema.js";
import type {
  MutableTableName,
} from "../utils/database/mutable_tables.js";
import type {
  TableMutationOperation,
  TableMutationTaskArgs,
} from "../utils/database/mutate_table.js";
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
  excludedOperations?: TableMutationOperation[];
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

export function registerTableHandlers<TTable extends SQLiteTable>(
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
    if (options.excludedOperations?.includes(operation)) continue;

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
