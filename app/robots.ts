/**
 * app/robots.ts — served at /robots.txt
 * -----------------------------------------------------------------------
 * The corporate site and public passport pages (/01/…) are crawlable;
 * the platform's authenticated and machine surfaces are not. Points
 * crawlers at the sitemap on the canonical domain (https://dpp-polymer.de
 * in production).
 */

import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/portal/", "/auditor", "/client-portal", "/supplier/", "/login"],
      },
    ],
    sitemap: new URL("/sitemap.xml", base).toString(),
    host: base.origin,
  };
}
