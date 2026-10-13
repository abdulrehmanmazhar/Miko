import { stock } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("stock", stock, {
  eventName: "stock",
  collectionKey: "stock",
});
