export type { Direction, DeepStringRecord, LanguageDefinition, MessageTree } from "./types";
export type { Messages } from "./en";
export type { Language, LanguageId } from "./registry";

export { ar } from "./ar";
export { en } from "./en";
export { es } from "./es";
export { fr } from "./fr";
export { ur } from "./ur";
export { zh } from "./zh";

export {
  DEFAULT_LANGUAGE_ID,
  formatMessage,
  getLanguage,
  getMessages,
  isLanguageId,
  languageList,
  languages,
  resolveLanguageId,
  resolveSystemLanguage,
} from "./registry";
export { useI18n } from "./useI18n";
