import { useEffect } from "react";
import { useAppSelector } from "@/redux/hooks";
import {
  selectAppearance,
  selectColorTheme,
  selectLanguage,
} from "@/extensions/settings/redux/settings.slice";
import { getLanguage, resolveLanguageId } from "@/i18n/registry";

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const appearance = useAppSelector(selectAppearance);
  const colorTheme = useAppSelector(selectColorTheme);
  const languagePreference = useAppSelector(selectLanguage);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyAppearance = () => {
      const isDark =
        appearance === "dark" || (appearance === "system" && media.matches);
      root.classList.toggle("dark", isDark);
    };

    applyAppearance();
    media.addEventListener("change", applyAppearance);
    return () => media.removeEventListener("change", applyAppearance);
  }, [appearance]);

  useEffect(() => {
    document.documentElement.dataset.colorTheme = colorTheme;
  }, [colorTheme]);

  useEffect(() => {
    const root = document.documentElement;

    const applyLanguage = () => {
      const languageId = resolveLanguageId(languagePreference);
      const language = getLanguage(languageId);
      root.lang = language.id;
      root.dir = language.direction;
      root.dataset.language = language.id;
    };

    applyLanguage();

    if (languagePreference !== "system") return;

    // Re-resolve when the OS / browser language preference changes (where supported).
    const onLanguageChange = () => applyLanguage();
    window.addEventListener("languagechange", onLanguageChange);
    return () => window.removeEventListener("languagechange", onLanguageChange);
  }, [languagePreference]);

  return children;
}

export default ThemeProvider;
