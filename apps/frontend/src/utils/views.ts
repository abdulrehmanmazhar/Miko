import type { ComponentType } from "react";

export type ViewRef = `${string}.${string}`;

const viewRegistry = new Map<ViewRef, ComponentType>();

export const registerView = (viewRef: ViewRef, component: ComponentType) => {
  viewRegistry.set(viewRef, component);
  const [extensionId] = viewRef.split(".");
  return { extensionId, viewId: viewRef };
};

export const getViewMeta = (viewRef: ViewRef) => {
  const component = viewRegistry.get(viewRef);
  if (!component) {
    throw new Error(`View with ref "${viewRef}" is not registered.`);
  }
  const [extensionId, viewName] = viewRef.split(".");
  return { extensionId, viewName, component };
};

export const hasView = (viewRef: ViewRef) => viewRegistry.has(viewRef);
