import { configureStore } from "@reduxjs/toolkit";
import layoutReducer from "@/redux/slices/layout.slice";
import settingsReducer from "@/extensions/settings/redux/settings.slice";

const store = configureStore({
  reducer: {
    layout: layoutReducer,
    settings: settingsReducer,
  },
  devTools: true,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
