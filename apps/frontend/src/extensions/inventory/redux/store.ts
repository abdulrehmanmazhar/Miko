import { configureStore } from "@reduxjs/toolkit";
import inventoryReducer from "./inventory.slice";

export const inventoryStore = configureStore({
  reducer: { inventory: inventoryReducer },
});

export type InventoryRootState = ReturnType<typeof inventoryStore.getState>;
export type InventoryDispatch = typeof inventoryStore.dispatch;
