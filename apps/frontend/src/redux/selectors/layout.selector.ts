import type { RootState } from "../store";

export const selectActiveExtensionId = (state: RootState) =>
  state.layout.activeExtensionId;

export const selectCurrentDialog = (state: RootState) => state.layout.dialog;

export const selectCurrentToasts = (state: RootState) => state.layout.toasts;

export const selectCurrentLeftPanel = (state: RootState) =>
  state.layout.leftPanel;

export const selectCurrentRightPanel = (state: RootState) =>
  state.layout.rightPanel;

export const selectCurrentBottomPanel = (state: RootState) =>
  state.layout.bottomPanel;

export const selectCurrentPlayground = (state: RootState) =>
  state.layout.playground;
