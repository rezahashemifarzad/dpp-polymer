/**
 * app/sitemap.ts — served at /sitemap.xml
 * -----------------------------------------------------------------------
 * Lists the public corporate-site pages (home, imprint, privacy) in every
 * language, each with hreflang alternates. Absolute URLs come from
 * siteUrl() (https://dpp-polymer.de in production). The platform itself
 * (/app, /admin, /portal/*, …) is intentionally not listed.
 */

import type { MetadataRoute } from "next";
import { LOCALE_ROUTES, SITE_LOCALES, siteUrl } from "@/lib/site-config";

const PAGES = ["home", "imprint", "privacy"] as const;

function absolute(path: string): string {
  return new URL(path, siteUrl()).toString();
}

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap((page) =>
    SITE_LOCALES.map((locale) => ({
      url: absolute(LOCALE_ROUTES[locale][page]),
      changeFrequency: page === "home" ? ("weekly" as const) : ("yearly" as const),
      priority: page === "home" ? 1 : 0.3,
      alternates: {
        languages: Object.fromEntries(SITE_LOCALES.map((l) => [l, absolute(LOCALE_ROUTES[l][page])])),
      },
    }))
  );
}
