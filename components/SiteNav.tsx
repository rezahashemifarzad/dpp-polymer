"use client";

/**
 * components/SiteNav.tsx
 * -----------------------------------------------------------------------
 * Shared top-level navigation for the app's INTERNAL surfaces — Home
 * (app/page.tsx), Admin Console, ESG Analytics, Auditor Portal, and
 * Client Portal. Rendered once from the root layout (app/layout.tsx)
 * instead of being hand-copied into each page's own header, which is
 * exactly the pattern that already caused real bugs this project: the
 * "Manage" button and the ESG Analytics / Auditor Portal / Client Portal
 * links each had to be independently re-added to more than one
 * un-synced page (see claude/circular-economy-platform-upgrade-notes.md's
 * "two independent Material Ledger tables" note). One nav, defined here
 * once, removes that whole class of drift for cross-page navigation links
 * going forward — it does not fix the existing per-page ledger/table
 * duplication, which is a separate, larger issue.
 *
 * Deliberately does NOT render on the public GS1/QR scan page
 * (/01/{GTIN}/21/{BATCH}, spec-fixed path — see lib/qr.ts). That page
 * already has its own self-contained, consumer-facing header (see
 * components/PublicScanPage.tsx) — stacking this internal-tooling nav
 * above it would both look like a mismatched double header and expose
 * "Admin Console" / "Auditor Portal" / "Client Portal" links to a random
 * end consumer scanning a product, which is a page meant to build trust
 * in the product data, not surface internal tooling.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShieldCheck, BarChart3, KeyRound, Building2 } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/admin", label: "Admin Console", icon: ShieldCheck },
  { href: "/admin/esg-analytics", label: "ESG Analytics", icon: BarChart3 },
  { href: "/auditor", label: "Auditor Portal", icon: KeyRound },
  { href: "/client-portal", label: "Client Portal", icon: Building2 },
] as const;

export default function SiteNav() {
  const pathname = usePathname();

  if (pathname?.startsWith("/01/")) return null;

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <Link href="/" className="text-sm font-bold text-black tracking-tight">
        Polymer<span className="text-emerald-600">.DPP</span>
      </Link>
      <nav className="flex items-center gap-5">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                active ? "text-black" : "text-gray-600 hover:text-black"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
