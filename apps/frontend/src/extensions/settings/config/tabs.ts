import type { ViewRef } from "@/utils/views";
import type { Messages } from "@/i18n";

export type SettingsTabId = keyof Messages["settings"]["tabs"];

export interface SettingsTab {
  id: SettingsTabId;
  playground: ViewRef;
}

export const SETTINGS_TABS: SettingsTab[] = [
  {
    id: "themes",
    // Matches the extension's default playground view key from registerExtension.
    playground: "figgosettings.playground",
  },
];
