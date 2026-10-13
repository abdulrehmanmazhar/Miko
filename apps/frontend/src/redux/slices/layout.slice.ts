import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type TViewRef = {
  extensionId: string;
  viewId: `${string}.${string}`;
};

interface TPanel {
  collapsed: boolean;
  view: TViewRef | null;
  width: string;
  height: string;
}

interface TDialog extends TPanel {
  fullscreen: boolean;
}

type TToast = {
  id: string;
  view: TViewRef;
  duration?: number;
};

interface ILayout {
  activeExtensionId: string | null;

  playground: TViewRef | null;

  leftPanel: TPanel;
  rightPanel: TPanel;
  bottomPanel: TPanel;
  dialog: TDialog;

  toasts: TToast[];
}

const initialState: ILayout = {
  activeExtensionId: null,
  playground: null,
  leftPanel: {
    collapsed: true,
    view: null,
    width: "0px",
    height: "100%",
  },
  rightPanel: {
    collapsed: true,
    view: null,
    width: "0px",
    height: "100%",
  },
  bottomPanel: {
    collapsed: true,
    view: null,
    width: "100%",
    height: "0px",
  },
  dialog: {
    collapsed: true,
    view: null,
    width: "60vw",
    height: "30vh",
    fullscreen: false,
  },
  toasts: [],
};

export const layoutSlice = createSlice({
  name: "layout",
  initialState,
  reducers: {
    setActiveExtensionId: (state, action: PayloadAction<string>) => {
      state.activeExtensionId = action.payload;
    },
    setPlayground: (state, action: PayloadAction<TViewRef | null>) => {
      state.playground = action.payload;
    },
    setLeftPanelView: (state, action: PayloadAction<TPanel["view"]>) => {
      state.leftPanel.view = action.payload;
    },
    setLeftPanelDimensions: (
      state,
      action: PayloadAction<{
        width: TPanel["width"];
        height: TPanel["height"];
      }>,
    ) => {
      state.leftPanel.width = action.payload.width;
      state.leftPanel.height = action.payload.height;
    },
    setLeftPanelCollapsed: (state, action: PayloadAction<boolean>) => {
      state.leftPanel.collapsed = action.payload;
    },
    setRightPanelView: (state, action: PayloadAction<TPanel["view"]>) => {
      state.rightPanel.view = action.payload;
    },
    setRightPanelDimensions: (
      state,
      action: PayloadAction<{
        width: TPanel["width"];
        height: TPanel["height"];
      }>,
    ) => {
      state.rightPanel.width = action.payload.width;
      state.rightPanel.height = action.payload.height;
    },
    setRightPanelCollapsed: (state, action: PayloadAction<boolean>) => {
      state.rightPanel.collapsed = action.payload;
    },
    setBottomPanelView: (state, action: PayloadAction<TPanel["view"]>) => {
      state.bottomPanel.view = action.payload;
    },
    setBottomPanelDimensions: (
      state,
      action: PayloadAction<{
        width: TPanel["width"];
        height: TPanel["height"];
      }>,
    ) => {
      state.bottomPanel.width = action.payload.width;
      state.bottomPanel.height = action.payload.height;
    },
    setBottomPanelCollapsed: (state, action: PayloadAction<boolean>) => {
      state.bottomPanel.collapsed = action.payload;
    },
    setDialogView: (state, action: PayloadAction<TPanel["view"]>) => {
      state.dialog.view = action.payload;
    },
    setDialogDimensions: (
      state,
      action: PayloadAction<{
        width: TPanel["width"];
        height: TPanel["height"];
      }>,
    ) => {
      state.dialog.width = action.payload.width;
      state.dialog.height = action.payload.height;
    },
    setDialogCollapsed: (state, action: PayloadAction<boolean>) => {
      state.dialog.collapsed = action.payload;
      if (action.payload) {
        state.dialog.fullscreen = false;
      }
    },
    setDialogFullscreen: (state, action: PayloadAction<boolean>) => {
      state.dialog.fullscreen = action.payload;
    },
    setToasts: (state, action: PayloadAction<TToast[]>) => {
      state.toasts = action.payload;
    },
    addToast: (state, action: PayloadAction<TToast>) => {
      state.toasts.push(action.payload);
    },
    pruneToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter(
        (toast) => toast.id !== action.payload,
      );
    },
    clearToasts: (state) => {
      state.toasts = [];
    },
  },
});

export default layoutSlice.reducer;
export const {
  setActiveExtensionId,
  setPlayground,
  setLeftPanelView,
  setLeftPanelDimensions,
  setLeftPanelCollapsed,
  setRightPanelView,
  setRightPanelDimensions,
  setRightPanelCollapsed,
  setBottomPanelView,
  setBottomPanelDimensions,
  setBottomPanelCollapsed,
  setDialogView,
  setDialogDimensions,
  setDialogCollapsed,
  setDialogFullscreen,
  setToasts,
  addToast,
  pruneToast,
  clearToasts,
} = layoutSlice.actions;
