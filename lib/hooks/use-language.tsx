"use client";

/**
 * lib/hooks/use-language.tsx
 * -----------------------------------------------------------------------
 * Bug fix — "the language selector only appears on the Home page; it
 * disappears when logging in or navigating to admin/other internal
 * pages." Home (app/page.tsx) previously held its own local
 * `useState<'EN'|'DE'|'FR'>` for this, wired only into its own header —
 * so leaving Home lost access to the switch entirely, even though
 * app/page.tsx's own `translations` object is still the only thing keyed
 * off this value. There's a separate, unrelated lib/i18n/dictionaries.ts
 * system (locale JSON dictionaries + its own LanguageSwitcher) that
 * already works fine for the public GS1 scan page
 * (components/PublicScanPage.tsx) — deliberately NOT touched here, since
 * that page is spec-constrained to stay locale-free in its URL and has
 * its own self-contained header (SiteNav never renders there — see that
 * file's own banner). This hook is the Home/admin-side equivalent: a
 * small shared Context so the SAME selected language is readable and
 * settable from any client component under <LanguageProvider> (mounted
 * once in app/layout.tsx), most importantly from SiteNav.tsx — the one
 * header shared by Home, /login, and every /admin/* page — instead of
 * being local, single-page state.
 *
 * Scope: this makes the SELECTOR itself globally visible, and its choice
 * persistent across navigation (via localStorage, same pattern
 * PublicScanPage.tsx already uses for its own locale). It does NOT, by
 * itself, translate every admin page's content — only app/page.tsx
 * currently has a translations dictionary to translate against. Wiring
 * more pages' copy through this same `lang` value is natural future
 * work, not attempted here.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "EN" | "DE" | "FR";

const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ["EN", "DE", "FR"];
const STORAGE_KEY = "dpp-app-language";

interface LanguageContextValue {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isAppLanguage(value: string | null): value is AppLanguage {
  return !!value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Default render is always 'EN' so server and client markup match on
  // first paint — a stored preference (if any) is applied in an effect
  // AFTER mount, the same pattern PublicScanPage.tsx already uses for its
  // own locale, so this never causes a hydration mismatch.
  const [lang, setLangState] = useState<AppLanguage>("EN");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isAppLanguage(stored)) setLangState(stored);
    } catch {
      /* localStorage unavailable (private browsing, blocked storage, etc.) — default language stands */
    }
  }, []);

  const setLang = useCallback((next: AppLanguage) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* best-effort persistence only — switching still works for this session */
    }
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
