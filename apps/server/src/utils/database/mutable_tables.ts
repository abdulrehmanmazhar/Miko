import {
  accounts,
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
} from "../../schema/tables.js";

export const mutableTables = {
  users,
  categories,
  units,
  warehouses,
  currencies,
  products,
  batches,
  batchPrices,
  stock,
  inventoryMovements,
  accounts,
  contacts,
  journalEntries,
  journalLines,
  salesInvoices,
  salesInvoiceLines,
  customerPayments,
  customerPaymentAllocation,
  settings,
} as const;

export type MutableTableName = keyof typeof mutableTables;

export function isMutableTableName(value: unknown): value is MutableTableName {
  return (
    typeof value === "string" &&
    Object.hasOwn(mutableTables, value)
  );
}
