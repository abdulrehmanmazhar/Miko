import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  selectAppearance,
  selectColorTheme,
  selectLanguage,
  setAppearance,
  setColorTheme,
  setLanguage,
  type Appearance,
  type ColorTheme,
  type LanguagePreference,
} from "@/extensions/settings/redux/settings.slice";
import { languages, useI18n, type LanguageId } from "@/i18n";
import { OptionButton } from "@/components/ui/option-button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

function ThemesPlayground() {
  const dispatch = useAppDispatch();
  const { t } = useI18n();
  const currentAppearance = useAppSelector(selectAppearance);
  const currentColorTheme = useAppSelector(selectColorTheme);
  const currentLanguage = useAppSelector(selectLanguage);

  const appearanceOptions: { value: Appearance; label: string }[] = [
    { value: "light", label: t.settings.themes.appearance.light },
    { value: "dark", label: t.settings.themes.appearance.dark },
    { value: "system", label: t.settings.themes.appearance.system },
  ];

  const colorThemeOptions: {
    value: ColorTheme;
    label: string;
    swatch: string;
  }[] = [
    {
      value: "default",
      label: t.settings.themes.colorTheme.default,
      swatch: "bg-neutral-800 dark:bg-neutral-200",
    },
    {
      value: "blue",
      label: t.settings.themes.colorTheme.blue,
      swatch: "bg-blue-600",
    },
    {
      value: "green",
      label: t.settings.themes.colorTheme.green,
      swatch: "bg-emerald-600",
    },
    {
      value: "violet",
      label: t.settings.themes.colorTheme.violet,
      swatch: "bg-violet-600",
    },
    {
      value: "orange",
      label: t.settings.themes.colorTheme.orange,
      swatch: "bg-orange-600",
    },
    {
      value: "rose",
      label: t.settings.themes.colorTheme.rose,
      swatch: "bg-rose-600",
    },
  ];

  const languageOptions: { value: LanguagePreference; label: string }[] = [
    { value: "system", label: t.settings.themes.language.system },
    ...(Object.keys(languages) as LanguageId[]).map((id) => ({
      value: id,
      label: `${languages[id].label} (${languages[id].nativeLabel})`,
    })),
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <PageHeader
        title={t.settings.themes.title}
        description={t.settings.themes.description}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-auto px-6 py-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-foreground">
            {t.settings.themes.appearance.title}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t.settings.themes.appearance.description}
          </p>
          <div className="flex flex-wrap gap-2">
            {appearanceOptions.map(({ value, label }) => (
              <OptionButton
                key={value}
                label={label}
                isActive={currentAppearance === value}
                onClick={() => dispatch(setAppearance(value))}
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-foreground">
            {t.settings.themes.colorTheme.title}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t.settings.themes.colorTheme.description}
          </p>
          <div className="flex flex-wrap gap-2">
            {colorThemeOptions.map(({ value, label, swatch }) => (
              <OptionButton
                key={value}
                label={label}
                isActive={currentColorTheme === value}
                onClick={() => dispatch(setColorTheme(value))}
              >
                <span className={cn("size-3 rounded-full", swatch)} />
              </OptionButton>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-foreground">
            {t.settings.themes.language.title}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t.settings.themes.language.description}
          </p>
          <div className="flex flex-wrap gap-2">
            {languageOptions.map(({ value, label }) => (
              <OptionButton
                key={value}
                label={label}
                isActive={currentLanguage === value}
                onClick={() => dispatch(setLanguage(value))}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default ThemesPlayground;
