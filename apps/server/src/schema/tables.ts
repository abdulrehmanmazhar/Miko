import { randomUUID } from "node:crypto";
import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

function generateId(): string {
  return randomUUID();
}
function generateTimestamp(): Date {
  return new Date();
}

export const actionRecords = sqliteTable(
  "action_records",
  {
    id: text("id").primaryKey().$defaultFn(generateId),

    // Groups multiple DB changes into one logical operation
    operationId: text("operation_id").notNull(),

    // Position of this action within the operation
    sequence: integer("sequence").notNull(),

    // INSERT | UPDATE | DELETE
    action: text("action", { enum: ["insert", "update", "delete"] }).notNull(),

    // The table affected
    tableName: text("table_name").notNull(),

    // Primary key of the affected row
    rowId: text("row_id").notNull(),

    // State before the action
    before: text("before", { mode: "json" }),

    // State after the action
    after: text("after", { mode: "json" }),

    // normal | undo | redo
    context: text("context", { enum: ["normal", "undo", "redo"] })
      .notNull()
      .default("normal"),

    // If this action was produced by undo/redo
    sourceActionId: text("source_action_id"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(generateTimestamp),
  },

  (table) => [
    index("action_logs_operation_idx").on(table.operationId),
    index("action_logs_created_at_idx").on(table.createdAt),
  ],
);

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(generateId),

  name: text("name"),
});
