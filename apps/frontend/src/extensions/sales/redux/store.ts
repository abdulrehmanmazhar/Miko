import { configureStore } from "@reduxjs/toolkit";
import salesReducer from "./sales.slice";

export const salesStore = configureStore({
  reducer: { sales: salesReducer },
});

export type SalesRootState = ReturnType<typeof salesStore.getState>;
export type SalesDispatch = typeof salesStore.dispatch;
