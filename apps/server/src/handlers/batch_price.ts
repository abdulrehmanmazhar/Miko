import { batchPrices } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("batchPrices", batchPrices, {
  eventName: "batch_prices",
  collectionKey: "batchPrices",
});
