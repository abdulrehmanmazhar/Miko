import { randomUUID } from "node:crypto";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import {
  integer,
  sqliteTable,
  text,
  index,
  real,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

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
    operationId: text("operation_id").notNull(),
    sequence: integer("sequence").notNull(),
    action: text("action", { enum: ["insert", "update", "delete"] }).notNull(),
    tableName: text("table_name").notNull(),
    rowId: text("row_id").notNull(),
    before: text("before", { mode: "json" }),
    after: text("after", { mode: "json" }),
    context: text("context", { enum: ["normal", "undo", "redo"] })
      .notNull()
      .default("normal"),
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
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(generateTimestamp),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey().$defaultFn(generateId),
  name: text("name").notNull(),
  for: text("for").notNull(),
  parentId: text("parent_id").references((): AnySQLiteColumn => categories.id, {
    onDelete: "cascade",
  }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(generateTimestamp),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const units = sqliteTable("units", {
  id: text("id").primaryKey().$defaultFn(generateId),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(generateTimestamp),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const warehouses = sqliteTable("warehouses", {
  id: text("id").primaryKey().$defaultFn(generateId),
  name: text("name").notNull(),
  location: text("location"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(generateTimestamp),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const currencies = sqliteTable("currencies", {
  id: text("id").primaryKey().$defaultFn(generateId),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(generateTimestamp),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey().$defaultFn(generateId),
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  unit: text("unit")
    .notNull()
    .references(() => units.id, { onDelete: "restrict" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  currencyId: text("currency_id")
    .notNull()
    .references(() => currencies.id, { onDelete: "restrict" }),
  trackInventory: integer("track_inventory", {
    mode: "boolean",
  })
    .notNull()
    .default(true),

  inventoryAccountId: text("inventory_account_id"),
  salesAccountId: text("sales_account_id"),
  cogsAccountId: text("cogs_account_id"),

  isActive: integer("is_active", {
    mode: "boolean",
  })
    .notNull()
    .default(true),
  extra: text("extra", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(generateTimestamp),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const batches = sqliteTable(
  "batches",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    batchNumber: text("batch_number").notNull(),
    mfgDate: integer("mfg_date", { mode: "timestamp_ms" }),
    expDate: integer("exp_date", { mode: "timestamp_ms" }),
    costPrice: integer("cost_price").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(generateTimestamp),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => ({
    productIdx: index("idx_batches_product_id").on(table.productId),
  }),
);

export const batchPrices = sqliteTable(
  "batch_prices",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
    batchId: text("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    salePrice: real("sale_price").notNull(),
    validFrom: integer("valid_from", { mode: "timestamp_ms" }).notNull(),
    validTo: integer("valid_to", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(generateTimestamp),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => ({
    batchPriceIdx: index("idx_prices_batches").on(table.batchId),
  }),
);

export const stock = sqliteTable(
  "stock",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
    batchId: text("batch_id")
      .notNull()
      .references(() => batches.id, {
        onDelete: "cascade",
      }),
    totalQuantity: integer("total_quantity").notNull().default(0),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, {
        onDelete: "cascade",
      }),
    warehouseId: text("warehouse_id"),
    validFrom: integer("valid_from", { mode: "timestamp_ms" }).notNull(),
    validTo: integer("valid_to", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(generateTimestamp),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => ({
    batchStockIdx: index("idx_stock_batches").on(table.batchId),
  }),
);

export const inventoryMovements = sqliteTable(
  "inventory_movements",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),

    productId: text("product_id")
      .notNull()
      .references(() => products.id, {
        onDelete: "restrict",
      }),

    batchId: text("batch_id").references(() => batches.id, {
      onDelete: "restrict",
    }),

    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouses.id, {
        onDelete: "restrict",
      }),

    type: text("type", {
      enum: [
        "purchase",
        "sale",
        "sale_return",
        "purchase_return",
        "adjustment",
        "transfer_in",
        "transfer_out",
        "opening_balance",
      ],
    }).notNull(),

    // Positive = stock in; negative = stock out.
    // Use a consistent scaled-integer quantity precision.
    quantityDelta: integer("quantity_delta").notNull(),

    // Unit cost in the chosen monetary minor unit,
    // e.g. paisa for PKR.
    unitCost: integer("unit_cost").notNull(),

    // Total inventory valuation change, in minor units.
    // Signed using the same convention as quantityDelta.
    valueDelta: integer("value_delta").notNull(),

    referenceType: text("reference_type"),
    referenceId: text("reference_id"),

    occurredAt: integer("occurred_at", {
      mode: "timestamp_ms",
    }).notNull(),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(generateTimestamp),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("inventory_movements_product_idx").on(table.productId),

    index("inventory_movements_batch_idx").on(table.batchId),

    index("inventory_movements_warehouse_idx").on(table.warehouseId),

    index("inventory_movements_occurred_at_idx").on(table.occurredAt),

    index("inventory_movements_reference_idx").on(
      table.referenceType,
      table.referenceId,
    ),

    check(
      "inventory_movements_quantity_nonzero",
      sql`${table.quantityDelta} <> 0`,
    ),
  ],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: text("type", {
      enum: ["asset", "liability", "equity", "income", "expense"],
    }).notNull(),
    parentId: text("parent_id"),
    // Is this a group/header account or an account
    // that can actually receive journal lines?
    isGroup: integer("is_group", { mode: "boolean" }).notNull().default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(generateTimestamp),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("accounts_code_unique").on(table.code),
    index("accounts_parent_idx").on(table.parentId),
    index("accounts_type_idx").on(table.type),
  ],
);

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey().$defaultFn(generateId),

  type: text("type", {
    enum: ["customer", "supplier", "both"],
  }).notNull(),

  name: text("name").notNull(),

  phone: text("phone"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  address: text("address"),

  taxNumber: text("tax_number"),

  receivableAccountId: text("receivable_account_id"),
  payableAccountId: text("payable_account_id"),

  creditLimit: integer("credit_limit"),

  isActive: integer("is_active", {
    mode: "boolean",
  })
    .notNull()
    .default(true),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(generateTimestamp),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const journalEntries = sqliteTable(
  "journal_entries",
  {
    id: text("id").primaryKey().$defaultFn(generateId),

    entryNumber: integer("entry_number").notNull(),

    date: integer("date", {
      mode: "timestamp_ms",
    }).notNull(),

    description: text("description"),

    referenceType: text("reference_type"),
    referenceId: text("reference_id"),

    status: text("status", {
      enum: ["draft", "posted", "voided"],
    })
      .notNull()
      .default("draft"),
    postedAt: integer("posted_at", {
      mode: "timestamp_ms",
    }),

    createdBy: text("created_by"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(generateTimestamp),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("journal_entry_number_unique").on(table.entryNumber),

    index("journal_entries_date_idx").on(table.date),

    index("journal_entries_reference_idx").on(
      table.referenceType,
      table.referenceId,
    ),
  ],
);

export const journalLines = sqliteTable(
  "journal_lines",
  {
    id: text("id").primaryKey().$defaultFn(generateId),

    journalEntryId: text("journal_entry_id").notNull(),

    accountId: text("account_id").notNull(),

    description: text("description"),

    debit: integer("debit").notNull().default(0),

    credit: integer("credit").notNull().default(0),

    contactId: text("contact_id"),

    productId: text("product_id"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(generateTimestamp),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("journal_lines_entry_idx").on(table.journalEntryId),

    index("journal_lines_account_idx").on(table.accountId),

    index("journal_lines_contact_idx").on(table.contactId),
  ],
);

export const salesInvoices = sqliteTable("sales_invoices", {
  id: text("id").primaryKey().$defaultFn(generateId),

  invoiceNumber: text("invoice_number").notNull(),

  customerId: text("customer_id"),

  date: integer("date", {
    mode: "timestamp_ms",
  }).notNull(),

  status: text("status", {
    enum: ["draft", "posted", "cancelled"],
  })
    .notNull()
    .default("draft"),

  subtotal: integer("subtotal").notNull(),
  discount: integer("discount").notNull(),
  tax: integer("tax").notNull(),
  total: integer("total").notNull(),

  journalEntryId: text("journal_entry_id"),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(generateTimestamp),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const salesInvoiceLines = sqliteTable("sales_invoice_lines", {
  id: text("id").primaryKey().$defaultFn(generateId),

  invoiceId: text("invoice_id").notNull(),

  productId: text("product_id").notNull(),

  description: text("description"),

  quantity: integer("quantity").notNull(),

  unitPrice: integer("unit_price").notNull(),

  discount: integer("discount").notNull(),

  tax: integer("tax").notNull(),

  total: integer("total").notNull(),
});

export const customerPayments = sqliteTable("customer_payments", {
  id: text("id").primaryKey().$defaultFn(generateId),

  customerId: text("customer_id").notNull(),

  amount: integer("amount").notNull(),

  paymentDate: integer("payment_date", {
    mode: "timestamp_ms",
  }).notNull(),

  paymentMethod: text("payment_method", {
    enum: ["cash", "bank", "card", "other"],
  }).notNull(),

  reference: text("reference"),

  journalEntryId: text("journal_entry_id"),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(generateTimestamp),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const customerPaymentAllocation = sqliteTable(
  "customer_payment_allocations",
  {
    id: text("id").primaryKey().$defaultFn(generateId),

    paymentId: text("payment_id").notNull(),

    invoiceId: text("invoice_id").notNull(),

    allocatedAmount: integer("allocated_amount").notNull(),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(generateTimestamp),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
);

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().$defaultFn(generateId),
  label: text("label").notNull(),
  body: text("body", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(generateTimestamp),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
