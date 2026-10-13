import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { database } from "../../services/database.js";

export const getPaginatedTable = <TTable extends SQLiteTable>(
  table: TTable,
  pageNumber: number,
  rowsPerPage: number,
) => {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new RangeError("pageNumber must be a positive integer.");
  }

  if (!Number.isInteger(rowsPerPage) || rowsPerPage < 1) {
    throw new RangeError("rowsPerPage must be a positive integer.");
  }

  const offset = (pageNumber - 1) * rowsPerPage;
  return database.select().from(table).limit(rowsPerPage).offset(offset);
};
