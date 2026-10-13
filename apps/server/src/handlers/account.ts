import { accounts } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("accounts", accounts, {
  eventName: "accounts",
  collectionKey: "accounts",
});
