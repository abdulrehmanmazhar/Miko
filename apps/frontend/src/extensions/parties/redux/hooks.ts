import { createDispatchHook, createSelectorHook } from "react-redux";
import type { TypedUseSelectorHook } from "react-redux";
import { ExtensionReduxContext } from "@/extensions/redux-context";
import type { PartiesDispatch, PartiesRootState } from "./store";

const useExtensionDispatch = createDispatchHook(ExtensionReduxContext);
const useExtensionSelector = createSelectorHook(ExtensionReduxContext);

export const useAppDispatch =
  useExtensionDispatch.withTypes<PartiesDispatch>();
export const useAppSelector: TypedUseSelectorHook<PartiesRootState> =
  useExtensionSelector;
