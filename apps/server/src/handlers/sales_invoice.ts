import { salesInvoices } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("salesInvoices", salesInvoices, {
  eventName: "sales_invoices",
  collectionKey: "salesInvoices",
});
