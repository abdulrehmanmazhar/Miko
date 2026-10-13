import { and, eq, getTableColumns, isNull } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { database } from "../../services/database.js";
import {
  isMutableTableName,
  mutableTables,
} from "./mutable_tables.js";

export type TableMutationOperation =
  | "create"
  | "update"
  | "soft_delete"
  | "hard_delete";

export type TableMutationTaskArgs = {
  tableName: string;
  operation: TableMutationOperation;
  id?: string;
  values?: Record<string, unknown>;
};

const managedFields = new Set(["createdAt", "updatedAt", "deletedAt"]);

function getSafeValues(
  table: SQLiteTable,
  values: Record<string, unknown>,
  operation: "create" | "update",
): Record<string, unknown> {
  const columns = getTableColumns(table);
  const unsupportedFields = Object.keys(values).filter(
    (key) =>
      !(key in columns) ||
      managedFields.has(key) ||
      (operation === "update" && key === "id"),
  );

  if (unsupportedFields.length > 0) {
    throw new Error(
      `Unsupported ${operation} fields: ${unsupportedFields.join(", ")}`,
    );
  }

  const safeValues = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );

  if (operation === "update" && Object.keys(safeValues).length === 0) {
    throw new Error("Update requires at least one field.");
  }

  return safeValues;
}

export async function mutateTable(
  args: TableMutationTaskArgs,
  operationId: string,
): Promise<{ operationId: string; record: unknown }> {
  if (operationId.length === 0) {
    throw new Error("Database mutations require an operation id.");
  }

  if (!isMutableTableName(args.tableName)) {
    throw new Error(`Unsupported table: ${args.tableName}`);
  }

  const table = mutableTables[args.tableName] as SQLiteTable;
  const columns = getTableColumns(table);
  const idColumn = columns.id;
  const deletedAtColumn = columns.deletedAt;
  const updatedAtColumn = columns.updatedAt;

  if (!idColumn) {
    throw new Error(`Table "${args.tableName}" does not have an id column.`);
  }

  switch (args.operation) {
    case "create": {
      if (!args.values || typeof args.values !== "object") {
        throw new Error("Create requires a values object.");
      }

      const values = getSafeValues(table, args.values, "create");
      const records = await database
        .insert(table)
        .values(values as never)
        .returning();
      const record = records[0];
      if (!record) throw new Error("Create did not return a row.");
      return { operationId, record };
    }

    case "update": {
      if (!args.id) throw new Error("Update requires a row id.");
      if (!args.values || typeof args.values !== "object") {
        throw new Error("Update requires a values object.");
      }

      const values = getSafeValues(table, args.values, "update");
      if (updatedAtColumn) values.updatedAt = new Date();

      const conditions = [eq(idColumn, args.id)];
      if (deletedAtColumn) conditions.push(isNull(deletedAtColumn));

      const records = await database
        .update(table)
        .set(values as never)
        .where(and(...conditions))
        .returning();
      const record = records[0];
      if (!record) throw new Error(`No active row found with id "${args.id}".`);
      return { operationId, record };
    }

    case "soft_delete": {
      if (!args.id) throw new Error("Soft delete requires a row id.");
      if (!deletedAtColumn) {
        throw new Error(`Table "${args.tableName}" does not support soft delete.`);
      }

      const values: Record<string, unknown> = { deletedAt: new Date() };
      if (updatedAtColumn) values.updatedAt = new Date();
      const records = await database
        .update(table)
        .set(values as never)
        .where(and(eq(idColumn, args.id), isNull(deletedAtColumn)))
        .returning();
      const record = records[0];
      if (!record) throw new Error(`No active row found with id "${args.id}".`);
      return { operationId, record };
    }

    case "hard_delete": {
      if (!args.id) throw new Error("Hard delete requires a row id.");

      const records = await database
        .delete(table)
        .where(eq(idColumn, args.id))
        .returning();
      const record = Array.isArray(records) ? records[0] : undefined;
      if (!record) throw new Error(`No row found with id "${args.id}".`);
      return { operationId, record };
    }
  }
}
