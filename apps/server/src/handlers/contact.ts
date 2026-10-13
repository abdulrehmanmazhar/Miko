import { contacts } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("contacts", contacts, {
  eventName: "contacts",
  collectionKey: "contacts",
});
