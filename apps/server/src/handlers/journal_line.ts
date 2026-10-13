import { journalLines } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("journalLines", journalLines, {
  eventName: "journal_lines",
  collectionKey: "journalLines",
});
