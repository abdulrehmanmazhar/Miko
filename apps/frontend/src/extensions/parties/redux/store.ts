import { configureStore } from "@reduxjs/toolkit";
import partiesReducer from "./parties.slice";

export const partiesStore = configureStore({
  reducer: { parties: partiesReducer },
});

export type PartiesRootState = ReturnType<typeof partiesStore.getState>;
export type PartiesDispatch = typeof partiesStore.dispatch;
