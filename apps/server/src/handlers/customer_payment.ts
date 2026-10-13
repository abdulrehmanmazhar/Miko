import { customerPayments } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("customerPayments", customerPayments, {
  eventName: "customer_payments",
  collectionKey: "customerPayments",
});
