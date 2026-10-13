export type Direction = "ltr" | "rtl";

export type MessageTree = {
  readonly [key: string]: string | MessageTree;
};

/** Keep message key structure from English while allowing translated string values. */
export type DeepStringRecord<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Record<string, unknown>
      ? DeepStringRecord<T[K]>
      : never;
};

/**
 * Shape every language file must export.
 * `messages` is typed from English so new keys are caught at compile time.
 */
export interface LanguageDefinition<TMessages extends MessageTree = MessageTree> {
  id: string;
  label: string;
  nativeLabel: string;
  direction: Direction;
  /** BCP 47 tags matched against `navigator.language` / `navigator.languages`. */
  locales: readonly string[];
  messages: TMessages;
}
