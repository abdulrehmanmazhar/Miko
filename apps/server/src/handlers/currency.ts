import { currencies } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("currencies", currencies, {
  eventName: "currencies",
  collectionKey: "currencies",
});
