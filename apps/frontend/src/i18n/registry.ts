import { ar } from "./ar";
import { en, type Messages } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { ur } from "./ur";
import { zh } from "./zh";
import type { LanguageDefinition } from "./types";

/**
 * Registry of supported languages.
 * To add one: create `i18n/[id].ts` exporting the same shape as `en`, then register it here.
 * Settings language toggles are derived from this map automatically.
 */
export const languages = {
  en,
  ur,
  ar,
  fr,
  es,
  zh,
} as const satisfies Record<string, LanguageDefinition<Messages>>;

export type LanguageId = keyof typeof languages;

export type Language = (typeof languages)[LanguageId];

export const DEFAULT_LANGUAGE_ID: LanguageId = "en";

export const languageList: Language[] = Object.values(languages);

export const isLanguageId = (value: string): value is LanguageId =>
  value in languages;

const matchLocale = (tag: string, locales: readonly string[]) => {
  const normalized = tag.toLowerCase();
  const primary = normalized.split("-")[0];

  return locales.some((locale) => {
    const candidate = locale.toLowerCase();
    return (
      normalized === candidate ||
      normalized.startsWith(`${candidate}-`) ||
      primary === candidate
    );
  });
};

/** Resolve the best-supported language from the OS / browser preference. */
export const resolveSystemLanguage = (): LanguageId => {
  if (typeof navigator === "undefined") return DEFAULT_LANGUAGE_ID;

  const tags = [...(navigator.languages ?? []), navigator.language].filter(
    Boolean,
  );

  for (const tag of tags) {
    const match = languageList.find((lang) => matchLocale(tag, lang.locales));
    if (match && isLanguageId(match.id)) return match.id;
  }

  return DEFAULT_LANGUAGE_ID;
};

export const getLanguage = (id: LanguageId): Language => languages[id];

export const resolveLanguageId = (
  preference: LanguageId | "system",
): LanguageId =>
  preference === "system" ? resolveSystemLanguage() : preference;

export const getMessages = (id: LanguageId): Messages => languages[id].messages;

/** Replace `{name}` placeholders in a translated string. */
export const formatMessage = (
  template: string,
  vars: Record<string, string | number>,
) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
