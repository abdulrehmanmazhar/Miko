import { units } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("units", units, {
  eventName: "units",
  collectionKey: "units",
});
