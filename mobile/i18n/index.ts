/**
 * Translation, kept to the smallest thing that does the job.
 *
 * No i18n library: the app has two languages and a few hundred strings, and a
 * dictionary lookup with `{placeholder}` substitution covers all of it. The
 * whole runtime is `translate()` below.
 *
 * Screens never call this directly — they take `t` from `useApp()`, which is
 * bound to the language in settings, so switching language re-renders every
 * screen at once rather than needing each one to subscribe.
 */
import { en, type TranslationKey } from "./en";
import { ne } from "./ne";

export type Language = "en" | "ne";
export type { TranslationKey };

/** Both languages named in their own script — a switcher you can read either way. */
export const LANGUAGES: { key: Language; label: string; native: string }[] = [
  { key: "en", label: "English", native: "English" },
  { key: "ne", label: "Nepali", native: "नेपाली" },
];

const DICTIONARIES: Record<Language, Partial<Record<TranslationKey, string>>> = { en, ne };

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "ne";
}

export type TVars = Record<string, string | number>;

/**
 * The string for `key`, with `{placeholders}` filled in.
 *
 * An untranslated key falls back to English rather than showing the key
 * itself, so a partially translated screen stays readable.
 */
export function translate(language: Language, key: TranslationKey, vars?: TVars): string {
  const template = DICTIONARIES[language]?.[key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole
  );
}

export type Translator = (key: TranslationKey, vars?: TVars) => string;

export function translatorFor(language: Language): Translator {
  return (key, vars) => translate(language, key, vars);
}

/**
 * The locale to hand `toLocaleDateString`. Nepali month and weekday names come
 * from the platform, so dates read in the chosen language too — and where a
 * device has no Nepali data, the ICU fallback is still a valid date rather
 * than an error.
 */
export function localeFor(language: Language): string {
  return language === "ne" ? "ne-NP" : "en-US";
}
