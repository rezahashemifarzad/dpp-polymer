"use client";

/**
 * components/LanguageSelector.tsx
 * -----------------------------------------------------------------------
 * The language dropdown itself — same markup/styling app/page.tsx's own
 * header already used, extracted here (rather than duplicated) so it can
 * also be mounted from SiteNav.tsx, making it globally visible instead of
 * Home-page-only. See lib/hooks/use-language.tsx's file banner for the
 * full rationale and scope.
 */

import { Languages } from "lucide-react";
import { useLanguage, type AppLanguage } from "@/lib/hooks/use-language";

export function LanguageSelector() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs font-mono text-slate-300">
      <Languages className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as AppLanguage)}
        aria-label="Select language"
        className="bg-transparent focus:outline-none text-xs cursor-pointer font-bold text-emerald-400"
      >
        <option value="EN" className="bg-slate-900 text-white">EN</option>
        <option value="DE" className="bg-slate-900 text-white">DE</option>
        <option value="FR" className="bg-slate-900 text-white">FR</option>
      </select>
    </div>
  );
}
