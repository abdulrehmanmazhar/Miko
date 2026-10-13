import { salesInvoiceLines } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("salesInvoiceLines", salesInvoiceLines, {
  eventName: "sales_invoice_lines",
  collectionKey: "salesInvoiceLines",
});
