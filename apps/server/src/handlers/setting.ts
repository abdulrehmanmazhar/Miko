import { settings } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("settings", settings, {
  eventName: "settings",
  collectionKey: "settings",
});
