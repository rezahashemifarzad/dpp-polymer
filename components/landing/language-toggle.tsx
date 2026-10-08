"use client";

/**
 * components/landing/language-toggle.tsx
 * -----------------------------------------------------------------------
 * EN | DE | FR segmented switch for the corporate site. Each option is a real
 * link to the same page in another language (/ ↔ /de ↔ /fr, /imprint ↔
 * /de/impressum ↔ /fr/mentions-legales, …), so it works without JavaScript
 * and every language has its own indexable URL.
 *
 * It also keeps the platform in step: choosing a language here stores it
 * as the app language (same localStorage key as lib/hooks/use-language.tsx),
 * and a first-time visitor who lands on /de or /fr gets that language in
 * /app too. An
 * existing app preference is never overwritten just by visiting a page.
 */

import Link from "next/link";
import { useEffect } from "react";
import { LANGUAGE_STORAGE_KEY, useLanguage } from "@/lib/hooks/use-language";
import type { SiteLocale } from "@/lib/site-config";
import { LOCALE_LABELS } from "@/lib/i18n/landing-dictionary";

interface LanguageToggleProps {
  current: SiteLocale;
  /** The equivalent page in each language. */
  hrefs: Record<SiteLocale, string>;
  label: string;
  /** "dark" for the navy header, "light" for white surfaces. */
  tone?: "dark" | "light";
}

const ORDER: SiteLocale[] = ["en", "de", "fr"];
const APP_LANG: Record<SiteLocale, "EN" | "DE" | "FR"> = { en: "EN", de: "DE", fr: "FR" };

export function LanguageToggle({ current, hrefs, label, tone = "dark" }: LanguageToggleProps) {
  const { setLang } = useLanguage();

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(LANGUAGE_STORAGE_KEY)) setLang(APP_LANG[current]);
    } catch {
      /* storage blocked — the page itself is already in the right language */
    }
  }, [current, setLang]);

  const dark = tone === "dark";

  return (
    <nav
      aria-label={label}
      className={`inline-flex items-center rounded-lg p-0.5 text-xs font-semibold ${
        dark ? "border border-white/12 bg-white/[0.04]" : "border border-slate-200 bg-slate-50"
      }`}
    >
      {ORDER.map((locale) => {
        const active = locale === current;
        return (
          <Link
            key={locale}
            href={hrefs[locale]}
            hrefLang={locale}
            lang={locale}
            aria-current={active ? "page" : undefined}
            title={LOCALE_LABELS[locale].name}
            onClick={() => setLang(APP_LANG[locale])}
            className={`rounded-md px-2 py-1 tracking-wide sm:px-2.5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 ${
              dark ? "focus-visible:outline-white" : "focus-visible:outline-navy-700"
            } ${
              active
                ? dark
                  ? "bg-white text-navy-950 shadow-sm"
                  : "bg-navy-900 text-white shadow-sm"
                : dark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-500 hover:text-navy-900"
            }`}
          >
            <span className="sr-only">{LOCALE_LABELS[locale].name}</span>
            <span aria-hidden="true">{LOCALE_LABELS[locale].short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
