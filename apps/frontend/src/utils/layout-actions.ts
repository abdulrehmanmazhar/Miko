import type { AppDispatch } from "@/redux/store";
import {
  addToast,
  clearToasts,
  setBottomPanelCollapsed,
  setBottomPanelDimensions,
  setBottomPanelView,
  setDialogCollapsed,
  setDialogDimensions,
  setDialogView,
  setDialogFullscreen,
  setRightPanelCollapsed,
  setRightPanelDimensions,
  setRightPanelView,
  pruneToast,
} from "@/redux/slices/layout.slice";
import type { ViewRef } from "@/utils/views";

const parseViewRef = (viewRef: ViewRef) => {
  const [extensionId] = viewRef.split(".");
  return { extensionId, viewId: viewRef };
};

export const openDialog = (
  dispatch: AppDispatch,
  viewRef: ViewRef,
  options?: { width?: string; height?: string; fullscreen?: boolean },
) => {
  dispatch(setDialogView(parseViewRef(viewRef)));
  if (options?.fullscreen) {
    dispatch(setDialogFullscreen(true));
    dispatch(
      setDialogDimensions({ width: "100%", height: "100%" }),
    );
  } else {
    dispatch(setDialogFullscreen(false));
    if (options?.width || options?.height) {
      dispatch(
        setDialogDimensions({
          width: options?.width ?? "480px",
          height: options?.height ?? "auto",
        }),
      );
    }
  }
  dispatch(setDialogCollapsed(false));
};

export const openFullscreenDialog = (
  dispatch: AppDispatch,
  viewRef: ViewRef,
) => {
  openDialog(dispatch, viewRef, { fullscreen: true });
};

export const closeDialog = (dispatch: AppDispatch) => {
  dispatch(setDialogCollapsed(true));
};

export const toggleDialog = (
  dispatch: AppDispatch,
  viewRef: ViewRef,
  isOpen: boolean,
  isSameView: boolean,
) => {
  if (isOpen && isSameView) {
    closeDialog(dispatch);
  } else {
    openDialog(dispatch, viewRef, { width: "480px", height: "auto" });
  }
};

export const showToast = (
  dispatch: AppDispatch,
  viewRef: ViewRef,
  options?: { id?: string; duration?: number },
) => {
  dispatch(
    addToast({
      id: options?.id ?? crypto.randomUUID(),
      view: parseViewRef(viewRef),
      duration: options?.duration ?? 5000,
    }),
  );
};

export const dismissToast = (dispatch: AppDispatch, id: string) => {
  dispatch(pruneToast(id));
};

export const dismissAllToasts = (dispatch: AppDispatch) => {
  dispatch(clearToasts());
};

export const populateRightPanel = (
  dispatch: AppDispatch,
  viewRef: ViewRef,
) => {
  dispatch(setRightPanelView(parseViewRef(viewRef)));
  dispatch(setRightPanelCollapsed(false));
  dispatch(setRightPanelDimensions({ width: "280px", height: "100%" }));
};

export const populateBottomPanel = (
  dispatch: AppDispatch,
  viewRef: ViewRef,
) => {
  dispatch(setBottomPanelView(parseViewRef(viewRef)));
  dispatch(setBottomPanelCollapsed(false));
  dispatch(setBottomPanelDimensions({ width: "100%", height: "200px" }));
};

export const toggleRightPanel = (
  dispatch: AppDispatch,
  collapsed: boolean,
) => {
  dispatch(setRightPanelCollapsed(!collapsed));
};

export const toggleBottomPanel = (
  dispatch: AppDispatch,
  collapsed: boolean,
) => {
  dispatch(setBottomPanelCollapsed(!collapsed));
};
