import { createContext } from "react";
import type { ReactReduxContextValue } from "react-redux";

export const ExtensionReduxContext =
  createContext<ReactReduxContextValue | null>(null);
