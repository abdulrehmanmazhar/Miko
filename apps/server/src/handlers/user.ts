import { users } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("users", users, {
  eventName: "users",
  collectionKey: "users",
});
