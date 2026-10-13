# Figgo Framework

A reusable **VS Code–style desktop app shell** built with React, Redux, and Tailwind CSS. Figgo gives you an extension-based workspace layout — sidebar, playground, resizable panels, dialogs, and toasts — so you can focus on building product features instead of reinventing the chrome for every app.

Extensions are **coded and registered at build time** (not hot-swappable plugins). This keeps the architecture simple while still giving you excellent developer experience across projects.

---

## Features

- **Extension system** — Register extensions with an id, name, description, icon, and sidebar position
- **Serializable views** — React components are mapped to string refs (`extensionId.viewName`) for Redux-safe state
- **VS Code–like layout** — Sidebar, main playground, optional left/right/bottom panels
- **Global overlays** — Dialogs (modal + full-screen) and toasts invokable from anywhere
- **Isolated extension state** — Each extension can ship its own Redux slice
- **Theming** — Light/dark/system appearance, accent color themes, LTR/RTL direction
- **shadcn-style UI** — oklch CSS variables, rounded panels, 1px borders, thin margins

---

## Tech Stack

| Layer    | Technology              |
| -------- | ----------------------- |
| Build    | Vite 8                  |
| UI       | React 19 + TypeScript 6 |
| State    | Redux Toolkit           |
| Styling  | Tailwind CSS v4         |
| Icons    | lucide-react            |
| Tooltips | Radix UI                |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

Open the app, click **Home** in the sidebar, and explore the quick links in the left panel.

---

## Layout Overview

```
┌──────────┬─────────────────────────────────────────────┐
│          │  Left Panel  │   Playground   │ Right Panel │
│ Sidebar  │              ├────────────────┤             │
│          │              │  Bottom Panel  │             │
└──────────┴─────────────────────────────────────────────┘
                    + Dialog overlay
                    + Toast stack (bottom-right)
```

| Region        | Purpose                                      |
| ------------- | -------------------------------------------- |
| **Sidebar**   | Extension icons (top 80% / bottom 20%)       |
| **Playground**| Main content area for the active extension   |
| **Left Panel**| Secondary navigation or tools                |
| **Right Panel**| Inspector, properties, context              |
| **Bottom Panel**| Console, status, logs                       |
| **Dialog**    | Modal or full-screen overlays                |
| **Toast**     | Transient notifications                      |

All panels use a shared shell: rounded corners, 1px margin, and a thin border, themed via CSS variables.

---

## Project Structure

```
src/
├── components/
│   ├── layout/          # Shell: Sidebar, panels, Dialog, Toast
│   ├── ui/              # Shared UI primitives (Tooltip, etc.)
│   └── ThemeProvider.tsx
├── extensions/
│   ├── home/            # Home extension + quick-link demos
│   │   ├── components/
│   │   ├── config/
│   │   └── redux/
│   ├── settings/        # Appearance, color theme, direction
│   └── index.ts         # Bootstraps all extensions
├── redux/
│   ├── slices/          # Global layout slice
│   ├── selectors/
│   ├── hooks.ts         # useAppDispatch, useAppSelector
│   └── store.ts
├── utils/
│   ├── extensions.ts    # registerExtension, activateExtension
│   ├── views.ts         # registerView, getViewMeta
│   └── layout-actions.ts# Dialog, toast, panel helpers
├── lib/utils.ts         # cn() utility
└── index.css            # Theme tokens (light/dark + color themes)
```

---

## Core Concepts

### Extensions

An extension is a self-contained module registered with metadata and views:

```typescript
import { Puzzle } from "lucide-react";
import { registerExtension } from "@/utils/extensions";
import MyPlayground from "./components/Playground";

registerExtension({
  id: "myext",
  name: "My Extension",
  description: "Does something useful",
  icon: Puzzle,
  position: "top", // or "bottom" for sidebar placement
  views: {
    playground: MyPlayground,
    leftPanel: MyLeftPanel,    // optional
    rightPanel: MyRightPanel,  // optional
    bottomPanel: MyBottomPanel // optional
  },
});
```

When a user clicks the sidebar icon, `activateExtension("myext", dispatch)` mounts the extension's default views.

### Views

Components cannot live in Redux directly. Instead, register them under a serializable ref:

```typescript
import { registerView } from "@/utils/views";

registerView("myext.settingsDialog", SettingsDialog);
//                         ↑ format: extensionId.viewName
```

Switch the playground programmatically:

```typescript
dispatch(setPlayground({
  extensionId: "myext",
  viewId: "myext.settingsDialog",
}));
```

### Layout Actions

Invoke global UI from any extension component:

```typescript
import {
  openDialog,
  openFullscreenDialog,
  closeDialog,
  showToast,
  dismissAllToasts,
  populateRightPanel,
  populateBottomPanel,
  toggleRightPanel,
  toggleBottomPanel,
} from "@/utils/layout-actions";

// Modal dialog
openDialog(dispatch, "myext.confirmDialog");

// Full-screen onboarding
openFullscreenDialog(dispatch, "myext.onboardingDialog");

// Toast notification
showToast(dispatch, "myext.savedToast", { duration: 5000 });

// Populate a panel
populateRightPanel(dispatch, "myext.inspector");
toggleRightPanel(dispatch, collapsed);
```

---

## Creating a New Extension

### 1. Scaffold the folder

```
src/extensions/myext/
├── index.ts
├── components/
│   └── Playground.tsx
└── redux/
    └── myext.slice.ts
```

### 2. Register the extension

```typescript
// src/extensions/myext/index.ts
import { registerExtension } from "@/utils/extensions";
import MyPlayground from "./components/Playground";

registerExtension({
  id: "myext",
  name: "My Extension",
  description: "My feature",
  icon: MyIcon,
  position: "top",
  views: { playground: MyPlayground },
});
```

### 3. Add the reducer

```typescript
// src/redux/store.ts
import myextReducer from "@/extensions/myext/redux/myext.slice";

const store = configureStore({
  reducer: {
    layout: layoutReducer,
    settings: settingsReducer,
    myext: myextReducer, // add here
  },
});
```

### 4. Bootstrap it

```typescript
// src/extensions/index.ts
import "./myext";
```

---

## Built-in Extensions

### ERP extensions

The workspace includes Inventory, Accounting, Sales, and Contacts extensions for
product management, accounting records, transactional sales, and customer/user
records. Each extension keeps its Redux state in an extension-local store.

### Settings (`figgosettings`)

Bottom sidebar slot. Controls workspace preferences:

- **Appearance** — Light / Dark / System
- **Color Theme** — Default, Blue, Green, Violet, Orange, Rose
- **Direction** — LTR / RTL

---

## Theming

Theme tokens live in `src/index.css` using oklch colors compatible with shadcn/ui conventions. Color themes are applied via `data-color-theme` on `<html>`. Dark mode uses the `.dark` class, managed by `ThemeProvider`.

---

## Redux State

### Layout slice (global)

Tracks workspace chrome:

- `activeExtensionId`
- `playground`, `leftPanel`, `rightPanel`, `bottomPanel`, `dialog`
- `toasts`
- Panel dimensions, collapsed state, dialog fullscreen flag

### Extension slices (isolated)

Each extension owns its domain state in an extension-local store.

Use typed hooks everywhere:

```typescript
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
```

---

## Design Decisions

**Why coded extensions instead of hot-swappable plugins?**
Simpler tooling, full TypeScript support, no runtime loading complexity. Ideal for personal/product apps where you control the codebase.

**Why view refs in Redux?**
Keeps state serializable and debuggable. The view registry resolves refs to components at render time.

**Why a shared shell?**
Build once, reuse across desktop app projects. Each new app becomes a question of which extensions to include.

---

## License

Private — reuse freely within your own projects.
