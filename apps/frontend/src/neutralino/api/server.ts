import { channel } from "./channel";

export type ServerTable =
  | "accounts"
  | "action_records"
  | "batches"
  | "batch_prices"
  | "categories"
  | "contacts"
  | "currencies"
  | "customer_payment_allocations"
  | "customer_payments"
  | "inventory_movements"
  | "journal_entries"
  | "journal_lines"
  | "products"
  | "sales_invoice_lines"
  | "sales_invoices"
  | "settings"
  | "stock"
  | "units"
  | "users"
  | "warehouses";

export type ServerRow = Record<string, unknown>;

type HandlerResult = {
  success: boolean;
  error?: unknown;
  operationId?: string;
  record?: ServerRow;
  product?: ServerRow[];
  products?: ServerRow[];
  accounts?: ServerRow[];
  action_records?: ServerRow[];
  [key: string]: unknown;
};

const collectionKeys: Record<ServerTable, string> = {
  accounts: "accounts",
  action_records: "products",
  batches: "batches",
  batch_prices: "batchPrices",
  categories: "categories",
  contacts: "contacts",
  currencies: "currencies",
  customer_payment_allocations: "customerPaymentAllocations",
  customer_payments: "customerPayments",
  inventory_movements: "inventoryMovements",
  journal_entries: "journalEntries",
  journal_lines: "journalLines",
  products: "products",
  sales_invoice_lines: "salesInvoiceLines",
  sales_invoices: "salesInvoices",
  settings: "settings",
  stock: "stock",
  units: "units",
  users: "users",
  warehouses: "warehouses",
};

function unwrap<T>(result: HandlerResult, key?: string): T {
  if (!result.success) {
    const error = result.error;
    throw new Error(
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Server handler request failed.",
    );
  }

  const value = key ? result[key] : result;
  if (value === undefined) {
    throw new Error(`Server response did not contain "${key ?? "result"}".`);
  }
  return value as T;
}

export const serverApi = {
  async getRows(
    table: ServerTable,
    pageNumber = 1,
    rowsPerPage = 100,
  ): Promise<ServerRow[]> {
    const result = await channel.request<HandlerResult>(`${table}.get`, {
      pageNumber,
      rowsPerPage,
    });
    const rows = unwrap<unknown>(result, collectionKeys[table]);
    if (!Array.isArray(rows)) {
      throw new Error(`Server response for ${table} was not a row list.`);
    }
    return rows.filter(
      (row): row is ServerRow =>
        typeof row === "object" && row !== null && !Array.isArray(row),
    );
  },

  async createRow(
    table: Exclude<ServerTable, "action_records">,
    values: ServerRow,
  ) {
    const params = table === "products" ? values : { values };
    const result = await channel.request<HandlerResult>(
      `${table}.create`,
      params,
    );
    return unwrap<{
      operationId?: string;
      record?: ServerRow;
      product?: ServerRow[];
    }>(result);
  },

  async updateRow(
    table: Exclude<ServerTable, "action_records">,
    id: string,
    values: ServerRow,
  ) {
    const result = await channel.request<HandlerResult>(`${table}.update`, {
      id,
      values,
    });
    return unwrap<{ operationId?: string; record?: ServerRow }>(result);
  },

  async deleteRow(
    table: Exclude<ServerTable, "action_records">,
    id: string,
    mode: "soft_delete" | "hard_delete" = "soft_delete",
  ) {
    const result = await channel.request<HandlerResult>(`${table}.${mode}`, {
      id,
    });
    return unwrap<{ operationId?: string; record?: ServerRow }>(result);
  },

  async recordSale(input: ServerRow) {
    const result = await channel.request<HandlerResult>(
      "business_functions.sale",
      input,
    );
    return unwrap<ServerRow>(result);
  },
};
