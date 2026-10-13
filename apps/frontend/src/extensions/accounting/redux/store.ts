import { configureStore } from "@reduxjs/toolkit";
import accountingReducer from "./accounting.slice";

export const accountingStore = configureStore({
  reducer: { accounting: accountingReducer },
});

export type AccountingRootState = ReturnType<typeof accountingStore.getState>;
export type AccountingDispatch = typeof accountingStore.dispatch;
