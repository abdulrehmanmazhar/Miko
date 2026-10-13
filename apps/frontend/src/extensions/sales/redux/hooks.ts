import { createDispatchHook, createSelectorHook } from "react-redux";
import type { TypedUseSelectorHook } from "react-redux";
import { ExtensionReduxContext } from "@/extensions/redux-context";
import type { SalesDispatch, SalesRootState } from "./store";

const useExtensionDispatch = createDispatchHook(ExtensionReduxContext);
const useExtensionSelector = createSelectorHook(ExtensionReduxContext);

export const useAppDispatch =
  useExtensionDispatch.withTypes<SalesDispatch>();
export const useAppSelector: TypedUseSelectorHook<SalesRootState> =
  useExtensionSelector;
