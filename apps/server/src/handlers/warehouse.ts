import { warehouses } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("warehouses", warehouses, {
  eventName: "warehouses",
  collectionKey: "warehouses",
});
