import { categories } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("categories", categories, {
  eventName: "categories",
  collectionKey: "categories",
  readAliases: ["catgories"],
});
