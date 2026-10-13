import { inventoryMovements } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("inventoryMovements", inventoryMovements, {
  eventName: "inventory_movements",
  collectionKey: "inventoryMovements",
});
