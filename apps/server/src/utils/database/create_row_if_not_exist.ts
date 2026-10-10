import { database } from "../../services/database.js";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

export const createRowIfNotExist = async <TTable extends SQLiteTable>(
  table: TTable,
  values: InferInsertModel<TTable>,
): Promise<InferSelectModel<TTable> | null> => {
  // 1. Build a selective dynamic where clause out of provided values
  // (Assuming uniqueness is determined by matching the provided fields)
  const record = values as Record<string, unknown>;
  const conditions = Object.entries(record)
    .filter(([, val]) => val !== undefined)
    .map(([key, val]) => eq((table as Record<string, any>)[key], val));

  if (conditions.length === 0) {
    throw new Error(
      "Cannot find or create a row without query criteria fields.",
    );
  }

  // 2. Query the SQLite database to see if a matching record exists
  const existingRows = (await database
    .select()
    .from(table)
    .where(and(...conditions))) as InferSelectModel<TTable>[];

  if (existingRows.length > 0) {
    return existingRows[0] ?? null;
  }

  // 3. Insert and return the newly created row if it doesn't exist
  const newRows = (await database
    .insert(table)
    .values(values as InferInsertModel<TTable>)
    .returning()) as InferSelectModel<TTable>[];

  return newRows[0] ?? null;
};
