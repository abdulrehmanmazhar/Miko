import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { AppDispatch } from "@/redux/store";
import {
  setActiveExtensionId,
  setBottomPanelCollapsed,
  setBottomPanelDimensions,
  setBottomPanelView,
  setLeftPanelCollapsed,
  setLeftPanelDimensions,
  setLeftPanelView,
  setPlayground,
  setRightPanelCollapsed,
  setRightPanelDimensions,
  setRightPanelView,
} from "@/redux/slices/layout.slice";
import { registerView, type ViewRef } from "@/utils/views";

export type ExtensionPosition = "top" | "bottom";

export interface ExtensionViews {
  playground?: ComponentType;
  leftPanel?: ComponentType;
  rightPanel?: ComponentType;
  bottomPanel?: ComponentType;
}

export interface IExtension {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  position: ExtensionPosition;
  views: ExtensionViews;
}

export const extensionRegistry = new Map<string, IExtension>();

const viewKey = (extensionId: string, panel: keyof ExtensionViews): ViewRef =>
  `${extensionId}.${panel}`;

export const registerExtension = (extension: IExtension) => {
  extensionRegistry.set(extension.id, extension);

  for (const [panel, component] of Object.entries(extension.views)) {
    if (component) {
      registerView(
        viewKey(extension.id, panel as keyof ExtensionViews),
        component,
      );
    }
  }
};

export const getExtensionsByPosition = (position: ExtensionPosition) =>
  Array.from(extensionRegistry.values()).filter(
    (ext) => ext.position === position,
  );

export const activateExtension = (
  extensionId: string,
  dispatch: AppDispatch,
) => {
  const extension = extensionRegistry.get(extensionId);
  if (!extension) return;

  dispatch(setActiveExtensionId(extensionId));

  if (extension.views.playground) {
    dispatch(
      setPlayground({
        extensionId,
        viewId: viewKey(extensionId, "playground"),
      }),
    );
  } else {
    dispatch(setPlayground(null));
  }

  if (extension.views.leftPanel) {
    dispatch(
      setLeftPanelView({
        extensionId,
        viewId: viewKey(extensionId, "leftPanel"),
      }),
    );
    dispatch(setLeftPanelCollapsed(false));
    dispatch(
      setLeftPanelDimensions({ width: "280px", height: "100%" }),
    );
  } else {
    dispatch(setLeftPanelView(null));
    dispatch(setLeftPanelCollapsed(true));
  }

  if (extension.views.rightPanel) {
    dispatch(
      setRightPanelView({
        extensionId,
        viewId: viewKey(extensionId, "rightPanel"),
      }),
    );
    dispatch(setRightPanelCollapsed(false));
    dispatch(
      setRightPanelDimensions({ width: "280px", height: "100%" }),
    );
  } else {
    dispatch(setRightPanelView(null));
    dispatch(setRightPanelCollapsed(true));
  }

  if (extension.views.bottomPanel) {
    dispatch(
      setBottomPanelView({
        extensionId,
        viewId: viewKey(extensionId, "bottomPanel"),
      }),
    );
    dispatch(setBottomPanelCollapsed(false));
    dispatch(
      setBottomPanelDimensions({ width: "100%", height: "200px" }),
    );
  } else {
    dispatch(setBottomPanelView(null));
    dispatch(setBottomPanelCollapsed(true));
  }
};
