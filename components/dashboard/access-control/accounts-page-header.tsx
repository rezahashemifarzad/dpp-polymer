"use client";

/**
 * components/dashboard/access-control/accounts-page-header.tsx
 * -----------------------------------------------------------------------
 * FIX (round 4 — language selector didn't translate admin pages): the
 * title/subtitle for app/admin/accounts/page.tsx used to be plain,
 * hardcoded JSX written directly inline in that file. That page is a
 * Server Component (no "use client", data fetched server-side — see its
 * own banner), so it can't call the useLanguage() hook itself; this tiny
 * client component is the header, pulled out just far enough to read the
 * current language and translate via lib/i18n/app-dictionary.ts's
 * "accounts.title" / "accounts.subtitle" keys, same text as before this
 * fix for English, DE/FR when switched.
 */

import { useLanguage } from "@/lib/hooks/use-language";

export function AccountsPageHeader() {
  const { t } = useLanguage();
  return (
    <div className="mb-8">
      <h1 className="text-xl font-bold tracking-wide">{t("accounts.title")}</h1>
      <p className="text-xs text-slate-400 mt-1">{t("accounts.subtitle")}</p>
    </div>
  );
}
