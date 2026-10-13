import { customerPaymentAllocation } from "../schema/tables.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers(
  "customerPaymentAllocation",
  customerPaymentAllocation,
  {
    eventName: "customer_payment_allocations",
    collectionKey: "customerPaymentAllocations",
  },
);
