import { desc, eq, sql, type EmptyRelations } from "drizzle-orm";
import type { SQLiteAsyncTransaction } from "drizzle-orm/sqlite-core";
import { actionRecords } from "../../schema/tables.js";
import { database } from "../../services/database.js";
import { pushActionContext } from "./index.js";
import crypto from "node:crypto";

type ActionRecord = typeof actionRecords.$inferSelect;

type Transaction = SQLiteAsyncTransaction<"sync", unknown, EmptyRelations>;

const parseSnapshot = (
  snapshot: ActionRecord["before"],
): Record<string, unknown> | null => {
  if (snapshot == null) {
    return null;
  }

  if (typeof snapshot === "string") {
    return JSON.parse(snapshot);
  }

  return snapshot as Record<string, unknown>;
};

const quoteIdentifier = (value: string): string => {
  return `"${value.replaceAll('"', '""')}"`;
};

const undoAction = (tx: Transaction, record: ActionRecord) => {
  const before = parseSnapshot(record.before);

  const tableName = sql.raw(quoteIdentifier(record.tableName));

  switch (record.action) {
    case "insert": {
      tx.run(sql`
        DELETE FROM ${tableName}
        WHERE "id" = ${record.rowId}
      `);

      break;
    }

    case "update": {
      if (!before) {
        throw new Error(
          `Cannot undo update action "${record.id}": missing before snapshot`,
        );
      }

      const assignments = Object.entries(before)
        .filter(([column]) => column !== "id")
        .map(([column, value]) => {
          return sql`
            ${sql.raw(quoteIdentifier(column))} = ${value}
          `;
        });

      if (assignments.length === 0) {
        throw new Error(
          `Cannot undo update action "${record.id}": no mutable columns found`,
        );
      }

      tx.run(sql`
        UPDATE ${tableName}
        SET ${sql.join(assignments, sql`, `)}
        WHERE "id" = ${record.rowId}
      `);

      break;
    }

    case "delete": {
      if (!before) {
        throw new Error(
          `Cannot undo delete action "${record.id}": missing before snapshot`,
        );
      }

      const entries = Object.entries(before);

      const columns = entries.map(([column]) =>
        sql.raw(quoteIdentifier(column)),
      );

      const values = entries.map(([, value]) => sql`${value}`);

      tx.run(sql`
        INSERT INTO ${tableName} (
          ${sql.join(columns, sql`, `)}
        )
        VALUES (
          ${sql.join(values, sql`, `)}
        )
      `);

      break;
    }

    default:
      throw new Error(
        `Unknown action "${record.action}" in action record "${record.id}"`,
      );
  }
};

export const undo = async (operationId: string) => {
  const records = await database
    .select()
    .from(actionRecords)
    .where(eq(actionRecords.operationId, operationId))
    .orderBy(desc(actionRecords.sequence));

  if (records.length === 0) {
    throw new Error(
      `Cannot undo operation "${operationId}": no action records found`,
    );
  }

  const undoOperationId = crypto.randomUUID();

  database.transaction((tx) => {
    pushActionContext(tx, undoOperationId, "undo", operationId);

    for (const record of records) {
      undoAction(tx, record);
    }
  });

  return undoOperationId;
};
