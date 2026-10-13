import { batches } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("batches", batches, {
  eventName: "batches",
  collectionKey: "batches",
});
