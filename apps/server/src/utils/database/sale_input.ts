export type SaleLineInput = {
  productId: string;
  batchId: string;
  warehouseId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  description?: string;
};

export type SaleInput = {
  invoiceNumber: string;
  customerId: string;
  date: number;
  dueDate: number;
  currencyId: string;
  createdBy: string;
  lines: SaleLineInput[];
  description?: string;
};

export type PreparedSaleLine = SaleLineInput & {
  discount: number;
  tax: number;
  lineSubtotal: number;
  lineTotal: number;
  unitCost: number;
  stockId: string;
  stockQuantity: number;
  salesAccountId: string;
  inventoryAccountId: string;
  cogsAccountId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function requireInteger(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(`${field} must be a non-negative safe integer.`);
  }
  return value;
}

function requireTimestamp(value: unknown, field: string): number {
  const timestamp = requireInteger(value, field);
  if (Number.isNaN(new Date(timestamp).getTime())) {
    throw new Error(`${field} must be a valid Unix timestamp in milliseconds.`);
  }
  return timestamp;
}

export function parseSaleInput(data: unknown): SaleInput {
  if (!isRecord(data)) throw new Error("Sale payload must be an object.");
  if (!Array.isArray(data.lines) || data.lines.length === 0) {
    throw new Error("A sale must contain at least one line.");
  }

  const lines = data.lines.map((value, index): SaleLineInput => {
    const prefix = `lines[${index}]`;
    if (!isRecord(value)) throw new Error(`${prefix} must be an object.`);

    const line: SaleLineInput = {
      productId: requireString(value.productId, `${prefix}.productId`),
      batchId: requireString(value.batchId, `${prefix}.batchId`),
      warehouseId: requireString(value.warehouseId, `${prefix}.warehouseId`),
      quantity: requireInteger(value.quantity, `${prefix}.quantity`),
      unitPrice: requireInteger(value.unitPrice, `${prefix}.unitPrice`),
      discount:
        value.discount === undefined
          ? 0
          : requireInteger(value.discount, `${prefix}.discount`),
    };
    if (line.quantity < 1) {
      throw new Error(`${prefix}.quantity must be greater than zero.`);
    }
    if (value.description !== undefined) {
      if (typeof value.description !== "string") {
        throw new Error(`${prefix}.description must be a string.`);
      }
      line.description = value.description;
    }
    return line;
  });

  const date = requireTimestamp(data.date, "date");
  const dueDate = requireTimestamp(data.dueDate, "dueDate");
  if (dueDate < date) {
    throw new Error("dueDate cannot be earlier than the sale date.");
  }

  return {
    invoiceNumber: requireString(data.invoiceNumber, "invoiceNumber"),
    customerId: requireString(data.customerId, "customerId"),
    date,
    dueDate,
    currencyId: requireString(data.currencyId, "currencyId"),
    createdBy: requireString(data.createdBy, "createdBy"),
    lines,
    ...(data.description === undefined
      ? {}
      : { description: requireString(data.description, "description") }),
  };
}
