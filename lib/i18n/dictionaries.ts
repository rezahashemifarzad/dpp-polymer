/**
 * lib/i18n/dictionaries.ts
 * -----------------------------------------------------------------------
 * Multi-Language Support for Public Passport Pages — the lightweight
 * dictionary/JSON approach requested, deliberately NOT a routing-based
 * i18n library (no next-intl, no next-i18next, no locale-prefixed routes
 * like /de/01/...). The GS1 Digital Link URI shape
 * (/01/{GTIN}/21/{BATCH}) is a fixed, spec-defined path — see lib/qr.ts's
 * own file banner — so locale switching happens client-side, in place, on
 * the already-resolved page, never by adding a locale segment to the URL.
 *
 * Every dictionary is a flat Record<string, string> keyed identically
 * (see lib/i18n/locales/en.json for the canonical key set — de.json and
 * fr.json must stay in sync with it). Values may contain `{placeholder}`
 * tokens for interpolation — see `translate()` below.
 *
 * Bundled directly (JSON import, not fetched at runtime) — three small
 * files, no network round-trip, no loading state needed for a language
 * switch. This is what "fast and clean" means here: switching language is
 * a synchronous object lookup, not an async route transition.
 */

import en from "./locales/en.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";

export const SUPPORTED_LOCALES = ["en", "de", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export type Dictionary = Record<string, string>;

const DICTIONARIES: Record<Locale, Dictionary> = { en, de, fr };

export const LOCALE_LABELS: Record<Locale, { short: string; native: string }> = {
  en: { short: "EN", native: "English" },
  de: { short: "DE", native: "Deutsch" },
  fr: { short: "FR", native: "Français" },
};

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Replaces `{token}` placeholders in `template` with values from `vars`.
 * A token with no matching var is left as-is (visibly wrong rather than
 * silently vanishing, which is easier to spot during translation review).
 */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  );
}

/**
 * Builds a `t(key, vars?)` translator bound to one locale. Falls back to
 * the English string, then to the raw key itself, if a key is ever
 * missing from a non-English dictionary (a translation gap should degrade
 * to readable English text, never to a blank label or a crash) — "robust"
 * per the feature request, without needing a heavier i18n framework's
 * fallback-chain machinery.
 */
export function createTranslator(locale: Locale) {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  return function t(key: string, vars?: Record<string, string | number>): string {
    const template = dict[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
    return interpolate(template, vars);
  };
}
