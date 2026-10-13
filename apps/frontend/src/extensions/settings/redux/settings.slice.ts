import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { isLanguageId, type LanguageId } from "@/i18n/registry";

export type Appearance = "light" | "dark" | "system";
export type ColorTheme =
  | "default"
  | "blue"
  | "green"
  | "violet"
  | "orange"
  | "rose";
export type LanguagePreference = LanguageId | "system";

interface SettingsState {
  appearance: Appearance;
  colorTheme: ColorTheme;
  language: LanguagePreference;
}

const initialState: SettingsState = {
  appearance: "system",
  colorTheme: "default",
  language: "system",
};

export const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setAppearance: (state, action: PayloadAction<Appearance>) => {
      state.appearance = action.payload;
    },
    setColorTheme: (state, action: PayloadAction<ColorTheme>) => {
      state.colorTheme = action.payload;
    },
    setLanguage: (state, action: PayloadAction<LanguagePreference>) => {
      const next = action.payload;
      if (next === "system" || isLanguageId(next)) {
        state.language = next;
      }
    },
  },
});

export const { setAppearance, setColorTheme, setLanguage } =
  settingsSlice.actions;

export const selectAppearance = (state: { settings: SettingsState }) =>
  state.settings.appearance;

export const selectColorTheme = (state: { settings: SettingsState }) =>
  state.settings.colorTheme;

export const selectLanguage = (state: { settings: SettingsState }) =>
  state.settings.language;

export default settingsSlice.reducer;
