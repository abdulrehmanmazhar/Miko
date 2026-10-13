import { journalEntries } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("journalEntries", journalEntries, {
  eventName: "journal_entries",
  collectionKey: "journalEntries",
});
