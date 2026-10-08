"use client";

/**
 * components/main-site-link.tsx
 * -----------------------------------------------------------------------
 * "← Back to Home" link to the public corporate website in the visitor's
 * platform language: "/" (EN), "/de" (DE) or "/fr" (FR), resolved through
 * lib/site-config.ts's homeForAppLanguage() — the same rule SiteNav's
 * "Main site" link uses. Used on pages that render outside the app chrome
 * (the /login card and the legacy /client-portal key gate).
 *
 * The language comes from LanguageProvider (root layout), which renders
 * English on the server and applies the stored preference after mount, so
 * markup always hydrates cleanly.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/lib/hooks/use-language";
import { homeForAppLanguage } from "@/lib/site-config";

interface MainSiteLinkProps {
  className?: string;
}

export function MainSiteLink({
  className = "inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300",
}: MainSiteLinkProps) {
  const { lang, t } = useLanguage();
  return (
    <Link href={homeForAppLanguage(lang)} className={className}>
      <ArrowLeft className="w-3 h-3" aria-hidden="true" /> {t("nav.backToHome")}
    </Link>
  );
}
