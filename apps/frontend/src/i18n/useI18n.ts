import { useMemo } from "react";
import { useAppSelector } from "@/redux/hooks";
import { selectLanguage } from "@/extensions/settings/redux/settings.slice";
import {
  formatMessage,
  getLanguage,
  resolveLanguageId,
} from "./registry";

export function useI18n() {
  const preference = useAppSelector(selectLanguage);
  const languageId = resolveLanguageId(preference);
  const language = getLanguage(languageId);

  return useMemo(
    () => ({
      languageId,
      language,
      t: language.messages,
      dir: language.direction,
      format: formatMessage,
    }),
    [language, languageId],
  );
}
