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
 * links each had to be independently re-added to more than one un-synced
 * page (see claude/circular-economy-platform-upgrade-notes.md's "two
 * independent Material Ledger tables" note). One nav, defined here once,
 * removes that whole class of drift for cross-page navigation links going
 * forward — it does not fix the existing per-page ledger/table
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
 *
 * Also deliberately does NOT render on /portal/auditor or /portal/customer
 * (Role-Based Authentication & Client/Auditor Portal Suite — access-control
 * fix). Those pages already have their own self-contained header (Home +
 * Sign Out) exactly like the public scan page above, and for the same two
 * reasons: this bar's brand link and its "Home" entry both point at "/" —
 * which is itself the full internal Material Ledger admin console, not a
 * neutral landing page — and this bar also lists an outright "Admin
 * Console" link. Stacking this nav above a signed-in Auditor's or
 * Customer's portal would let one click hand them administrative data
 * their session has no business seeing. Each portal page's own Home link
 * now points at that same portal (never at "/"), so this exclusion is the
 * belt to that link's suspenders, not the only fix.
 *
 * Theme: dark slate/zinc, matching every internal page this nav actually
 * appears above (app/page.tsx, app/admin/page.tsx, app/auditor/page.tsx,
 * app/client-portal/page.tsx are all bg-slate-950). An earlier version of
 * this file used a light gray/white theme, which read as a mismatched bar
 * stacked on top of those pages — fixed here.
 *
 * Responsive behavior:
 *   - >= lg: full horizontal pill nav, icon + label per link.
 *   - md .. lg: same horizontal nav, icon-only (label in a `title` tooltip)
 *     so five links + the brand mark never wrap or overflow in that
 *     narrower-but-still-"desktop" band.
 *   - < md: a compact bar (brand + hamburger button) that expands a
 *     slide-down panel with every link stacked, full-width, comfortable
 *     touch targets. Closes on: selecting a link, a route change,
 *     clicking the backdrop, or Escape. Background scroll is locked while
 *     it's open so the panel doesn't visually fight page content behind it.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShieldCheck, BarChart3, KeyRound, Building2, LogIn, Menu, X } from "lucide-react";
// Phase 7 - Step 3 (Advanced Global Search & Multi-Layer Filtering Suite)
// — mounted from here, not hand-copied into each /admin/* page's own
// header, for the exact same "one shared component, no drift" reason
// this file's own banner already gives for NAV_LINKS. Gated to the
// /admin section only (see isAdminSection below) — the search results it
// surfaces (supplier tiers especially) are internal-tooling data that has
// no place on the Auditor Portal / Client Portal / public Home chrome
// this same shared header also renders.
import { GlobalSearchPalette } from "@/components/dashboard/global-search-palette";
// In-Page Floating AI Assistant Widget — mounted here for the same
// "one shared component, no drift" reason as GlobalSearchPalette above,
// and gated to the same /admin section for the same reason: it can
// answer questions that surface SupplierTier data (ADMIN-gated
// everywhere else this app exposes it), so it has no place on the
// Auditor Portal / Client Portal / public Home chrome this shared header
// also renders. `position: fixed` (see that component) means it renders
// outside <header> below, not inside it — this is a floating overlay
// pinned to the viewport, not part of the nav bar itself.
import { AiAssistantWidget } from "@/components/dashboard/ai-assistant-widget";
// Bug fix — "the language selector only appears on the home page; it
// disappears on login/admin/other internal pages." Rendered here,
// unconditionally (not gated to isAdminSection like GlobalSearchPalette/
// AiAssistantWidget above), so it's visible on every page this shared
// header renders on — see lib/hooks/use-language.tsx's file banner for
// the full rationale.
import { LanguageSelector } from "@/components/LanguageSelector";
// FIX (round 4 — nav labels didn't translate): labelKey looks up
// lib/i18n/app-dictionary.ts via useLanguage()'s t() below at render time
// instead of a hardcoded English string.
import { useLanguage } from "@/lib/hooks/use-language";
import { getViewerRoleAction } from "@/lib/actions/get-viewer-role";

const NAV_LINKS = [
  { href: "/", labelKey: "nav.home", icon: Home },
  { href: "/admin", labelKey: "nav.admin", icon: ShieldCheck },
  { href: "/admin/esg-analytics", labelKey: "nav.esg", icon: BarChart3 },
  { href: "/auditor", labelKey: "nav.auditor", icon: KeyRound },
  { href: "/client-portal", labelKey: "nav.client", icon: Building2 },
  // Role-Based Authentication & Client/Auditor Portal Suite — listed
  // alongside the existing key-based /auditor and /client-portal links,
  // same "always-visible, not an access boundary" treatment (see this
  // file's own banner: the real gates live on the routes themselves, not
  // in nav visibility). Routes to /login, which auto-detects AUDITOR vs
  // CUSTOMER by email and lands the signed-in user on /portal/auditor or
  // /portal/customer.
  { href: "/login", labelKey: "nav.signin", icon: LogIn },
] as const;

// Access-control audit (2026-09-30): links into the admin console are shown
// only to a signed-in ADMIN. Hiding them is UX only — /admin/* is enforced
// server-side by app/admin/layout.tsx — but guests should not be offered
// management areas they cannot use.
const ADMIN_ONLY_HREFS = new Set<string>(["/admin", "/admin/esg-analytics"]);

export default function SiteNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();
  const [viewerRole, setViewerRole] = useState<"ADMIN" | "AUDITOR" | "CUSTOMER" | null>(null);

  // Re-resolve on every navigation so signing in/out (both end in a
  // redirect) updates the visible links. Defaults to null = guest, so admin
  // links never flash for an anonymous visitor.
  useEffect(() => {
    let cancelled = false;
    getViewerRoleAction()
      .then((role) => {
        if (!cancelled) setViewerRole(role);
      })
      .catch(() => {
        if (!cancelled) setViewerRole(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const visibleLinks = NAV_LINKS.filter(({ href }) => viewerRole === "ADMIN" || !ADMIN_ONLY_HREFS.has(href));

  // Auto-close on every route change — the primary mechanism for "clicking
  // a link closes the menu" (belt-and-suspenders with each Link's own
  // onClick below, which also covers re-clicking the already-active link,
  // where pathname doesn't change).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Escape-to-close + background scroll lock while the mobile panel is
  // open, so it doesn't visually fight the page scrolling behind it —
  // standard polish for any slide-over/dropdown menu.
  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  if (pathname?.startsWith("/01/")) return null;
  if (pathname?.startsWith("/portal/")) return null;

  // Scopes the global search trigger (and its Cmd/Ctrl+K shortcut, since
  // GlobalSearchPalette only exists in the DOM at all when this is true)
  // to the admin console section of the app — see the import comment
  // above for why this shouldn't reach the Auditor/Client Portal/Home
  // chrome this same shared header also renders.
  const isAdminSection = pathname?.startsWith("/admin") ?? false;

  return (
    <>
    {/* Bug fix — "top navigation toolbar isn't fixed/sticky, so scrolling
        a long admin page or a tall modal traps the user away from the
        Admin Console / Home shortcuts." This header was `relative`, which
        scrolls away with the page like any other block element. `sticky
        top-0` pins it to the top of the viewport on every screen size
        (mobile included — the responsive behavior below is unaffected,
        this only changes whether the bar scrolls with the page). z-50 is
        unchanged from before, so this still sits above page content and
        below nothing else that mattered at that layer. */}
    <header className="sticky top-0 z-50 bg-slate-950 border-b border-slate-800">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4">
        <Link
          href="/"
          className="shrink-0 text-sm font-bold tracking-tight text-white hover:text-slate-200 transition-colors"
        >
          Polymer<span className="text-emerald-400">.DPP</span>
        </Link>

        <div className="flex items-center gap-2 min-w-0">
          {isAdminSection && (
            <div className="shrink-0">
              <GlobalSearchPalette />
            </div>
          )}

          <div className="shrink-0">
            <LanguageSelector />
          </div>

          {/* Desktop / tablet nav — md and up. Icon-only from md to lg (a
              `title` attribute stands in as the accessible/hover label) so
              five links never wrap at exactly the md breakpoint; full
              icon+label from lg up. */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl shrink-0">
            {visibleLinks.map(({ href, labelKey, icon: Icon }) => {
              const active = pathname === href;
              const label = t(labelKey);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-1.5 px-2.5 lg:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    active
                      ? "bg-emerald-500 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden lg:inline whitespace-nowrap">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Mobile hamburger — below md only */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="site-nav-mobile-panel"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            className="md:hidden shrink-0 p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile panel + backdrop — rendered only below md (the button that
          triggers it is md:hidden, so this can never open on wider
          viewports). Backdrop is a separate element positioned beneath the
          panel; clicking it (i.e. anywhere outside the panel) closes the
          menu, while clicks inside the panel land on the panel itself and
          never reach the backdrop. */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 top-14 z-40 bg-black/50 backdrop-blur-[1px] animate-[fadeIn_150ms_ease-out]"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            id="site-nav-mobile-panel"
            ref={panelRef}
            className="md:hidden absolute inset-x-0 top-full z-50 bg-slate-950 border-b border-slate-800 shadow-xl shadow-black/40 animate-[slideDown_180ms_ease-out]"
          >
            <nav className="px-3 py-3 space-y-1">
              {visibleLinks.map(({ href, labelKey, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-emerald-500 text-slate-950 font-semibold"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5 shrink-0" />
                    {t(labelKey)}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </header>
    {isAdminSection && <AiAssistantWidget />}
    </>
  );
}
