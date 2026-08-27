"use client";

/**
 * components/PublicScanPage.tsx
 * -----------------------------------------------------------------------
 * Rendered by app/01/[gtin]/21/[serialOrBatch]/page.tsx (the GS1 resolver).
 * This is what a B2B buyer, auditor, or inspector sees when they scan the
 * QR code printed on a polymer bag/container.
 *
 * Visual language matches the manufacturer dashboard (PolymerPassportUI.jsx)
 * for brand consistency: slate/teal/amber palette, IBM Plex Sans/Mono, and
 * the same "hash fingerprint" barcode motif used there — this page is
 * where that motif does its real job (proving data integrity), rather
 * than the illustrative preview it was on the dashboard.
 *
 * NOTE: for production, prefer next/font/google over the runtime @import
 * below (avoids a render-blocking font fetch) — kept as @import here only
 * to match the standalone preview artifact byte-for-byte during review.
 *
 * Multi-Language Support (see lib/i18n/dictionaries.ts) — every static UI
 * label on this page goes through `t(key, vars?)`, a locale bound to
 * local component state and switched entirely client-side (no route
 * change, no server round-trip: the GS1 Digital Link URI shape is fixed
 * by spec and must not grow a locale segment). The chosen locale persists
 * across visits via localStorage — safe here because this is the real
 * product's own page, not a Claude-hosted preview artifact. Data VALUES
 * (batch IDs, hashes, numbers, dates) are never translated, only the
 * labels around them; dates are formatted per-locale via
 * toLocaleDateString(locale, ...).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck, ShieldAlert, Leaf, Recycle, Layers, Gauge, Hash,
  BadgeCheck, ExternalLink, Download, Copy, Check, AlertTriangle,
  Factory, CalendarDays, Clock, CheckCircle2, GitBranch, FileText,
  UserCheck, Languages, Link2, Sprout, Settings2, Truck, CircleDot,
  LogIn, ChevronRight, ShieldOff,
} from "lucide-react";
import {
  type Locale, SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_LABELS,
  isSupportedLocale, createTranslator,
} from "@/lib/i18n/dictionaries";
// In-Page Floating AI Assistant Widget, public rollout — mounted here
// (this page's own chrome, since SiteNav deliberately never renders on
// this route — see that file's own banner) with theme="light" to match
// this permanently light-themed page, and scope="public" so it calls the
// separate, restricted askPublicAssistantAction rather than the admin
// action (see lib/actions/ask-assistant.ts's file banner for why those
// are two distinct functions, not one gated by a client-supplied flag).
import { AiAssistantWidget } from "@/components/dashboard/ai-assistant-widget";

/* ---------------------------------------------------------------------------
 * Types — mirror the JSON shape page.tsx passes down (Decimals already
 * converted to numbers, Dates already converted to ISO strings).
 * ------------------------------------------------------------------------*/
interface CertificationView {
  scheme: string;
  certificateId: string;
  issuingBody: string;
  validFrom: string;
  validUntil: string;
  documentUrl: string | null;
}

// Circular Economy Platform Upgrade (Step 4) additions — a slimmer summary
// of each parent batch than the admin view uses (see
// lib/verifyPassport.ts's GenealogyParentSummary), since a scanner should
// see enough to identify the upstream batch, not its full internal record.
interface GenealogyParentView {
  batchId: string;
  gtin: string;
  polymerType: string;
  grade: string;
  recycledContentPercent: number;
}

interface GenealogyLinkView {
  id: string;
  quantityUsedKg: number | null;
  notes: string | null;
  parentPassport: GenealogyParentView;
}

// Multi-tier Supply Chain Verification & Auditor Portal Expansion. page.tsx
// only ever passes tier records whose status is VERIFIED — same "never
// show unverified/negative claims as fact" convention as certifications
// above (see that filter in app/01/[gtin]/21/[serialOrBatch]/page.tsx) —
// so there is no status field here at all: everything reaching this
// component is already a positive trust signal.
type ChainOfCustodyTierValue =
  | "RAW_MATERIAL_SUPPLIER"
  | "RECYCLER"
  | "COMPOUNDER"
  | "PROCESSOR"
  | "DISTRIBUTOR"
  | "OTHER";

interface ChainOfCustodyLinkView {
  id: string;
  sequence: number;
  tier: ChainOfCustodyTierValue;
  participantName: string;
  participantCountry: string | null;
  externalBatchId: string;
  certificationScheme: string | null;
  massBalanceAllocationPercent: number | null;
  reviewedAt: string | null;
}

// Deliberately a distinct, narrower type than the admin dashboard's
// ApiCarbonFootprintCalculation — the public page only ever renders the
// breakdown + methodology version, never raw calculator inputs.
interface CarbonFootprintCalculationView {
  scope1KgCO2e: number;
  scope2KgCO2e: number;
  scope3KgCO2e: number;
  totalKgCO2e: number;
  weightKg: number;
  transportMode: "TRUCK" | "RAIL" | "SEA" | "AIR";
  emissionFactorVersion: string;
}

// Third-Party Auditor Verification Workflow. page.tsx only ever passes
// this prop when the passport's LATEST auditor verification event has
// status AUDITOR_VERIFIED — a REJECTED_BY_AUDITOR record is never sent
// down to this component, so there is no "rejected" branch to render here
// by design. Audit notes are deliberately NOT part of this view (portal
// and admin-only — see lib/services/submit-auditor-verification.ts).
interface AuditorSignOffView {
  auditorName: string;
  auditorOrganization: string;
  signedAt: string;
}

interface PassportView {
  polymerType: string;
  grade: string;
  gtin: string;
  meltFlowIndex: number;
  mfiTestStandard: string;
  density: number;
  densityTestStandard: string;
  recycledContentSource: string | null;
  recycledContentPercent: number;
  bioBasedPercent: number;
  carbonFootprintKgCO2ePerKg: number;
  lcaMethodology: string;
  lcaScope: string;
  lcaThirdPartyVerified: boolean;
  lcaVerifierName: string | null;
  batchId: string;
  productionDate: string;
  status: string;
  // No-Hard-Delete / Immutability Enforcement — only ever non-null when
  // status is "REVOKED". See the render branch below this component's
  // main return, which shows the compliance notice instead of the full
  // data body when status is "REVOKED" — this record is never physically
  // deleted, only status-flipped, so the batch/GTIN identity above always
  // still resolves.
  revokedAt: string | null;
  revocationReason: string | null;
  manufacturer: { legalName: string; country: string };
  certifications: CertificationView[];
  recordHash: string;
  hashAlgorithm: string;
  previousRecordHash: string | null;
  signedAt: string | null;
  parentLinks: GenealogyLinkView[];
  carbonFootprintCalculation: CarbonFootprintCalculationView | null;
  chainOfCustodyRecords: ChainOfCustodyLinkView[];
}

interface PublicScanPageProps {
  passport: PassportView;
  integrityVerified: boolean;
  linkTrusted: boolean;
  auditorSignOff: AuditorSignOffView | null;
}

const LOCALE_STORAGE_KEY = "dpp-locale";

/* Same fingerprint device used on the dashboard — here driven by the real recordHash. */
function fingerprintBars(hash: string, count = 48) {
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    const byte = parseInt(hash.substr((i * 2) % hash.length, 2), 16) || 0;
    bars.push(10 + (byte / 255) * 90);
  }
  return bars;
}

function FingerprintStrip({ hash, tone }: { hash: string; tone: "teal" | "rose" }) {
  const bars = useMemo(() => fingerprintBars(hash), [hash]);
  const barColor = tone === "teal" ? "bg-teal-500" : "bg-rose-500";
  return (
    <div className="flex items-end gap-[2px] h-12 w-full">
      {bars.map((h, i) => (
        <div key={i} className={`flex-1 ${barColor} rounded-sm`} style={{ height: `${h}%`, opacity: 0.4 + (h / 100) * 0.6 }} />
      ))}
    </div>
  );
}

// Same tier icon set as components/dashboard/chain-of-custody-timeline.tsx
// (the dark-dashboard equivalent) — kept as a separate, deliberately small
// copy here rather than a shared import, since this page never imports
// dashboard components (see this file's own banner comment on why the
// public page doesn't share components across its light theme and the
// dashboard's dark one).
const COC_TIER_ICONS: Record<ChainOfCustodyTierValue, typeof Sprout> = {
  RAW_MATERIAL_SUPPLIER: Sprout,
  RECYCLER: Recycle,
  COMPOUNDER: Factory,
  PROCESSOR: Settings2,
  DISTRIBUTOR: Truck,
  OTHER: CircleDot,
};

const CERT_LABELS: Record<string, string> = {
  ISCC_PLUS: "ISCC PLUS",
  REDCERT2: "REDcert2",
  GRS: "Global Recycled Standard",
  RECYCLASS: "RecyClass",
  ISO_14021: "ISO 14021",
  ISO_14040_44: "ISO 14040/44",
  EN_15343: "EN 15343",
  EN_16785: "EN 16785",
  OTHER: "Certification",
};

// Certification scheme names are proper/standard names (ISCC PLUS, GRS,
// ...) — these do not get translated per locale, same convention as batch
// IDs and hashes below. Only the status word wrapping them
// (Expired/Valid/...) is localized, via `t()` at each call site.
function certStatus(
  validUntil: string,
  t: ReturnType<typeof createTranslator>
): { label: string; cls: string; icon: typeof CheckCircle2 } {
  const days = (new Date(validUntil).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return { label: t("certStatus.expired"), cls: "bg-rose-50 text-rose-700 border-rose-200", icon: AlertTriangle };
  if (days < 60) return { label: t("certStatus.expiringSoon"), cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock };
  return { label: t("certStatus.valid"), cls: "bg-teal-50 text-teal-700 border-teal-200", icon: CheckCircle2 };
}

function CopyableHash({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — silently ignore, the hash is still visible/selectable */
    }
  };
  return (
    <button
      onClick={copy}
      className="w-full flex items-center justify-between gap-2 rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-left hover:bg-slate-700 transition-colors"
    >
      <span className="text-xs f-mono text-slate-300 break-all">{hash}</span>
      {copied ? <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
    </button>
  );
}

/* A small segmented control — EN / DE / FR — switching `locale` entirely
   client-side. No page reload, no route change: see this file's own
   banner comment for why the GS1 Digital Link URI must stay locale-free. */
function LanguageSwitcher({ locale, onChange, label }: { locale: Locale; onChange: (l: Locale) => void; label: string }) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <Languages className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
      <div className="flex rounded-md border border-slate-700 overflow-hidden">
        {SUPPORTED_LOCALES.map((code) => (
          <button
            key={code}
            onClick={() => onChange(code)}
            aria-pressed={locale === code}
            aria-label={LOCALE_LABELS[code].native}
            className={`px-2 py-1 text-[10px] f-mono font-medium transition-colors ${
              locale === code
                ? "bg-teal-500 text-slate-950"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }`}
          >
            {LOCALE_LABELS[code].short}
          </button>
        ))}
      </div>
    </div>
  );
}

// No-Hard-Delete / Immutability Enforcement — replaces the full dynamic
// passport body on this page when status is "REVOKED". Deliberately does
// NOT render any of the technical/sustainability/carbon/composition
// sections above (those remain fully intact in the database and in the
// authenticated /auditor and /portal/auditor views, which are unaffected
// by this page's rendering choice) — a revoked passport is no longer a
// valid compliance claim for the general public scanning it. Still shows
// enough identity (GTIN/batch/manufacturer, already rendered in the shared
// header above this component) for the visitor to know what they scanned,
// plus why and when it was revoked when the manufacturer provided a
// reason, plus an explicit statement that the audit trail is preserved,
// not erased — the point of this whole feature.
function RevokedNotice({
  passport,
  t,
  locale,
}: {
  passport: PassportView;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
}) {
  return (
    <div className="max-w-md mx-auto px-5 py-6 space-y-5">
      <div>
        <h1 className="f-display text-xl font-semibold text-slate-900">{passport.polymerType} · {passport.grade}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs f-mono text-slate-500">
          <span>GTIN {passport.gtin}</span>
          <span>·</span>
          <span>{passport.batchId}</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs f-body text-slate-500">
          <Factory className="w-3.5 h-3.5" /> {passport.manufacturer.legalName} · {passport.manufacturer.country}
        </div>
      </div>

      <section className="rounded-xl bg-rose-50 border border-rose-200 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-rose-600 flex items-center justify-center">
            <ShieldOff className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-rose-900 f-body">{t("revoked.title")}</div>
            <p className="text-xs text-rose-800 f-body mt-1">{t("revoked.notice")}</p>
          </div>
        </div>
        {passport.revocationReason && (
          <div className="text-xs f-body text-rose-800 bg-rose-100/60 border border-rose-200 rounded-lg px-3 py-2">
            {t("revoked.reason", { reason: passport.revocationReason })}
          </div>
        )}
        {passport.revokedAt && (
          <div className="text-[11px] f-body text-rose-700">
            {t("revoked.date", { date: new Date(passport.revokedAt).toLocaleString(locale) })}
          </div>
        )}
      </section>

      <p className="text-xs f-body text-slate-500 leading-relaxed">{t("revoked.auditNotice")}</p>

      <Link
        href="/login"
        className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white text-xs f-body font-medium py-3 hover:bg-slate-800 transition-colors"
      >
        <LogIn className="w-4 h-4" /> {t("auth.login")}
      </Link>

      <div className="text-center pt-1 pb-4">
        <a href="https://gs1.org/standards/digital-link" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] f-body text-slate-400 hover:text-slate-600">
          {t("footer.resolvedVia")} <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export default function PublicScanPage({ passport, integrityVerified, linkTrusted, auditorSignOff }: PublicScanPageProps) {
  const circularity = passport.recycledContentPercent + passport.bioBasedPercent;
  const virgin = Math.max(0, 100 - circularity);
  const overallTrusted = integrityVerified && linkTrusted;
  // No-Hard-Delete / Immutability Enforcement — a revoked passport is
  // NEVER deleted, only status-flipped (see transitionPassportStatus); the
  // record, its hash chain, and its full audit trail all still exist and
  // remain reachable to authorized auditors. This page just stops showing
  // the full dynamic dataset to the general public once revoked — see the
  // render branch below.
  const isRevoked = passport.status === "REVOKED";

  // Default render is always English (DEFAULT_LOCALE) so server and
  // client markup match on first paint — a stored preference (if any) is
  // applied in an effect AFTER mount, which re-renders once but never
  // causes a hydration mismatch, since the initial client render still
  // matches what the server sent.
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isSupportedLocale(stored)) setLocale(stored);
    } catch {
      /* localStorage unavailable (private browsing, blocked storage, etc.) — default locale stands */
    }
  }, []);
  const changeLocale = (next: Locale) => {
    setLocale(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* best-effort persistence only — switching still works for this view */
    }
  };
  const t = useMemo(() => createTranslator(locale), [locale]);

  return (
    <div className="min-h-screen bg-slate-50 f-body">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .f-display { font-family: 'Space Grotesk', sans-serif; }
        .f-body { font-family: 'IBM Plex Sans', system-ui, sans-serif; }
        .f-mono { font-family: 'IBM Plex Mono', monospace; }
      `}</style>

      {/* Trust banner — only shown when something is actually wrong */}
      {!overallTrusted && (
        <div className="bg-rose-600 text-white text-center py-2 px-4 text-xs f-body font-medium flex items-center justify-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          {!linkTrusted ? t("banner.linkMismatch") : t("banner.integrityFailed")}
        </div>
      )}

      <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-teal-400 shrink-0" />
          <span className="f-mono text-[11px] tracking-widest text-slate-400 truncate">{t("brand")}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <LanguageSwitcher locale={locale} onChange={changeLocale} label={t("language.label")} />
          {overallTrusted ? (
            <span className="flex items-center gap-1.5 text-teal-400 text-xs f-body font-medium">
              <ShieldCheck className="w-4 h-4" /> {t("status.verified")}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-rose-400 text-xs f-body font-medium">
              <ShieldAlert className="w-4 h-4" /> {t("status.unverified")}
            </span>
          )}
        </div>
      </div>

      {/* Role-Based Authentication & Client/Auditor Portal Suite — a
          discoverable path to the new session-based /login flow, for an
          auditor or customer who wants the fuller /portal/auditor or
          /portal/customer view. The public passport view above stays fully
          open with no auth required — this is purely an optional path
          onward, never a gate. Deliberately its own full-width strip
          (rather than crammed into the dark header's already-busy
          brand/language/status row) so the full requested copy fits
          without fighting for space at narrow widths. Routed through t()
          for i18n consistency with the rest of this page's UI chrome. */}
      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 bg-teal-50 hover:bg-teal-100 border-b border-teal-200 text-teal-800 text-xs f-body font-medium px-4 py-2.5 transition-colors"
      >
        <LogIn className="w-3.5 h-3.5 shrink-0" />
        <span className="text-center">{t("auth.login")}</span>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
      </Link>

      {isRevoked ? (
        <RevokedNotice passport={passport} t={t} locale={locale} />
      ) : (
      <div className="max-w-md mx-auto px-5 py-6 space-y-5">
        {/* Product header — polymer type/grade, GTIN, batch ID, and
            manufacturer name are DATA, not UI labels, so they are never
            passed through t() — only the German/French UI wrapping them
            (elsewhere on this page) changes with locale. */}
        <div>
          <h1 className="f-display text-xl font-semibold text-slate-900">{passport.polymerType} · {passport.grade}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs f-mono text-slate-500">
            <span>GTIN {passport.gtin}</span>
            <span>·</span>
            <span>{passport.batchId}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs f-body text-slate-500">
            <Factory className="w-3.5 h-3.5" /> {passport.manufacturer.legalName} · {passport.manufacturer.country}
          </div>
        </div>

        {/* Third-Party Auditor Sign-off (Third-Party Auditor Verification
            Workflow) — deliberately placed high on the page, right after
            the product header, so it reads as a prominent trust signal
            rather than a footnote. Only rendered when the latest review
            event for this batch is AUDITOR_VERIFIED; a REJECTED_BY_AUDITOR
            record (or no review yet) renders nothing here at all — this
            section is a positive trust signal only, never a warning. */}
        {auditorSignOff && (
          <section className="rounded-xl bg-teal-50 border border-teal-200 p-4 flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-full bg-teal-600 flex items-center justify-center">
              <UserCheck className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="f-body text-sm font-semibold text-teal-900">{t("auditor.title")}</div>
              <div className="text-xs f-body text-teal-800 mt-0.5">
                {t("auditor.signedBy", { name: auditorSignOff.auditorName, org: auditorSignOff.auditorOrganization })}
              </div>
              <div className="text-[11px] f-body text-teal-600 mt-0.5">
                {new Date(auditorSignOff.signedAt).toLocaleDateString(locale, {
                  year: "numeric", month: "long", day: "numeric",
                })}
              </div>
            </div>
          </section>
        )}

        {/* Technical properties */}
        <section className="rounded-xl bg-white border border-slate-200 p-4">
          <h2 className="f-display text-sm font-semibold text-slate-900 flex items-center gap-1.5 mb-3">
            <Gauge className="w-4 h-4 text-teal-700" /> {t("tech.title")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t("tech.mfi"), value: `${passport.meltFlowIndex} g/10min`, sub: passport.mfiTestStandard },
              { label: t("tech.density"), value: `${passport.density} g/cm³`, sub: passport.densityTestStandard },
            ].map((p) => (
              <div key={p.label} className="rounded-lg bg-slate-50 p-3">
                <div className="text-[10px] text-slate-400 f-body">{p.label}</div>
                <div className="f-mono text-base font-medium text-slate-900">{p.value}</div>
                <div className="text-[10px] text-slate-400 f-body mt-0.5">{p.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Composition */}
        <section className="rounded-xl bg-white border border-slate-200 p-4">
          <h2 className="f-display text-sm font-semibold text-slate-900 flex items-center gap-1.5 mb-3">
            <Recycle className="w-4 h-4 text-teal-700" /> {t("composition.title")}
          </h2>
          <div className="flex h-3 w-full overflow-hidden rounded-full border border-slate-200 mb-2">
            <div className="bg-teal-600" style={{ width: `${passport.recycledContentPercent}%` }} />
            <div className="bg-emerald-400" style={{ width: `${passport.bioBasedPercent}%` }} />
            <div className="bg-slate-200" style={{ width: `${virgin}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="f-mono text-sm font-medium text-teal-700">{passport.recycledContentPercent}%</div>
              <div className="text-[10px] text-slate-400 f-body">
                {passport.recycledContentSource === "POST_CONSUMER"
                  ? t("composition.postConsumer")
                  : passport.recycledContentSource === "POST_INDUSTRIAL"
                  ? t("composition.postIndustrial")
                  : t("composition.recycled")}
              </div>
            </div>
            <div>
              <div className="f-mono text-sm font-medium text-emerald-600">{passport.bioBasedPercent}%</div>
              <div className="text-[10px] text-slate-400 f-body">{t("composition.bioBased")}</div>
            </div>
            <div>
              <div className="f-mono text-sm font-medium text-slate-500">{virgin}%</div>
              <div className="text-[10px] text-slate-400 f-body">{t("composition.virgin")}</div>
            </div>
          </div>
        </section>

        {/* Carbon footprint */}
        <section className="rounded-xl bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="f-display text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <Leaf className="w-4 h-4 text-emerald-600" /> {t("carbon.title")}
              </h2>
              <div className="text-[10px] text-slate-400 f-body mt-0.5">
                {passport.lcaMethodology} · {passport.lcaScope}
                {passport.lcaThirdPartyVerified &&
                  ` · ${t("carbon.verifiedBy", { name: passport.lcaVerifierName ?? t("carbon.thirdPartyFallback") })}`}
              </div>
            </div>
            <span className="f-mono text-lg font-medium text-slate-900">
              {passport.carbonFootprintKgCO2ePerKg} <span className="text-xs text-slate-400">kgCO₂e/kg</span>
            </span>
          </div>

          {/* Illustrative Scope 1/2/3 estimate — deliberately visually
              subordinate (smaller, muted, clearly labeled) to the verified
              LCA figure above. This is a rough calculator output from
              generic emission factors, never a substitute for the
              manufacturer's own (optionally third-party-verified) figure —
              see lib/utils/carbon-footprint-calculator.ts and the
              greenwashing-risk note in lib/services/calculate-carbon-footprint.ts. */}
          {passport.carbonFootprintCalculation && (
            <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
              <div className="text-[10px] text-slate-400 f-body mb-2">
                {t("carbon.illustrative", { version: passport.carbonFootprintCalculation.emissionFactorVersion })}
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="f-mono text-xs font-medium text-slate-600">
                    {passport.carbonFootprintCalculation.scope1KgCO2e}
                  </div>
                  <div className="text-[9px] text-slate-400 f-body">{t("carbon.scope1")}</div>
                </div>
                <div>
                  <div className="f-mono text-xs font-medium text-slate-600">
                    {passport.carbonFootprintCalculation.scope2KgCO2e}
                  </div>
                  <div className="text-[9px] text-slate-400 f-body">{t("carbon.scope2")}</div>
                </div>
                <div>
                  <div className="f-mono text-xs font-medium text-slate-600">
                    {passport.carbonFootprintCalculation.scope3KgCO2e}
                  </div>
                  <div className="text-[9px] text-slate-400 f-body">{t("carbon.scope3")}</div>
                </div>
                <div>
                  <div className="f-mono text-xs font-semibold text-slate-700">
                    {passport.carbonFootprintCalculation.totalKgCO2e}
                  </div>
                  <div className="text-[9px] text-slate-400 f-body">{t("carbon.total")}</div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Batch Lineage / Supply-Chain Genealogy */}
        {passport.parentLinks.length > 0 && (
          <section className="rounded-xl bg-white border border-slate-200 p-4">
            <h2 className="f-display text-sm font-semibold text-slate-900 flex items-center gap-1.5 mb-3">
              <GitBranch className="w-4 h-4 text-teal-700" /> {t("lineage.title")}
            </h2>
            <div className="space-y-2">
              {passport.parentLinks.map((link) => (
                <div key={link.id} className="rounded-lg bg-slate-50 p-3 flex items-center justify-between">
                  <div>
                    <div className="f-mono text-xs font-medium text-slate-900">{link.parentPassport.batchId}</div>
                    <div className="text-[10px] text-slate-400 f-body mt-0.5">
                      {link.parentPassport.polymerType} · {link.parentPassport.grade} ·{" "}
                      {link.parentPassport.recycledContentPercent}% {t("lineage.recycled")}
                      {link.quantityUsedKg ? ` · ${t("lineage.kgUsed", { qty: link.quantityUsedKg })}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Multi-Tier Chain of Custody (Multi-tier Supply Chain
            Verification & Auditor Portal Expansion) — records reaching this
            page are already filtered to status VERIFIED by page.tsx (see
            this file's ChainOfCustodyLinkView comment above), so this
            section renders unconditionally as a positive trust signal, same
            pattern as the Auditor Sign-off section higher up. */}
        {passport.chainOfCustodyRecords.length > 0 && (
          <section className="rounded-xl bg-white border border-slate-200 p-4">
            <h2 className="f-display text-sm font-semibold text-slate-900 flex items-center gap-1.5 mb-3">
              <Link2 className="w-4 h-4 text-teal-700" /> {t("coc.title")}
            </h2>
            <div className="space-y-2">
              {[...passport.chainOfCustodyRecords]
                .sort((a, b) => a.sequence - b.sequence)
                .map((record) => {
                  const TierIcon = COC_TIER_ICONS[record.tier] ?? CircleDot;
                  return (
                    <div key={record.id} className="rounded-lg bg-slate-50 p-3 flex items-start gap-3">
                      <div className="shrink-0 w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center mt-0.5">
                        <TierIcon className="w-3.5 h-3.5 text-teal-700" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-slate-400 f-body">{t(`coc.tier.${record.tier}`)}</div>
                        <div className="f-mono text-xs font-medium text-slate-900">{record.participantName}</div>
                        <div className="text-[10px] text-slate-400 f-body mt-0.5">
                          {record.participantCountry ? `${record.participantCountry} · ` : ""}
                          {t("coc.batch", { id: record.externalBatchId })}
                          {record.certificationScheme ? ` · ${CERT_LABELS[record.certificationScheme] ?? record.certificationScheme}` : ""}
                          {record.massBalanceAllocationPercent != null
                            ? ` · ${t("coc.massBalance", { pct: record.massBalanceAllocationPercent })}`
                            : ""}
                        </div>
                        {record.reviewedAt && (
                          <div className="text-[10px] text-teal-600 f-body mt-0.5 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {t("coc.verifiedOn", { date: new Date(record.reviewedAt).toLocaleDateString(locale) })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* Certifications */}
        <section>
          <h2 className="f-display text-sm font-semibold text-slate-900 flex items-center gap-1.5 mb-3">
            <BadgeCheck className="w-4 h-4 text-amber-600" /> {t("certifications.title")}
          </h2>
          <div className="space-y-2">
            {passport.certifications.map((c, i) => {
              const st = certStatus(c.validUntil, t);
              const StIcon = st.icon;
              return (
                <div key={i} className="rounded-xl bg-white border border-slate-200 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="f-body text-sm font-semibold text-slate-900">{CERT_LABELS[c.scheme] ?? c.scheme}</div>
                      <div className="text-xs f-body text-slate-500 mt-0.5">{c.issuingBody}</div>
                      <div className="text-[11px] f-mono text-slate-400 mt-1">{c.certificateId}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] f-body font-medium ${st.cls}`}>
                      <StIcon className="w-3 h-3" /> {st.label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] f-body">
                    <span className="text-slate-400 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {t("certifications.validUntil", { date: new Date(c.validUntil).toLocaleDateString(locale) })}
                    </span>
                    {c.documentUrl ? (
                      <a href={c.documentUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-teal-700 font-medium hover:text-teal-800">
                        <Download className="w-3.5 h-3.5" /> {t("certifications.download")}
                      </a>
                    ) : (
                      <span className="text-slate-300">{t("certifications.noDocument")}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Data Integrity & Cryptographic Security */}
        <section className="rounded-xl bg-slate-900 p-5">
          <h2 className="f-display text-sm font-semibold text-white flex items-center gap-1.5 mb-1">
            <Hash className="w-4 h-4 text-amber-400" /> {t("integrity.title")}
          </h2>
          <p className="text-[11px] f-body text-slate-400 mb-3">{t("integrity.description")}</p>

          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-3 ${
            integrityVerified ? "bg-teal-950/50 border border-teal-800" : "bg-rose-950/50 border border-rose-800"
          }`}>
            {integrityVerified ? (
              <>
                <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
                <span className="text-xs f-body text-teal-300 font-medium">
                  {t("integrity.verified", { algo: passport.hashAlgorithm })}
                </span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-xs f-body text-rose-300 font-medium">{t("integrity.warning")}</span>
              </>
            )}
          </div>

          {!linkTrusted && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3 bg-amber-950/50 border border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs f-body text-amber-300 font-medium">{t("integrity.linkMismatch")}</span>
            </div>
          )}

          <FingerprintStrip hash={passport.recordHash} tone={integrityVerified ? "teal" : "rose"} />

          <div className="mt-3 space-y-2">
            <div>
              <span className="text-[10px] f-body text-slate-500 block mb-1">
                {t("integrity.recordHash", { algo: passport.hashAlgorithm })}
              </span>
              <CopyableHash hash={passport.recordHash} />
            </div>
            {passport.previousRecordHash && (
              <div>
                <span className="text-[10px] f-body text-slate-500 block mb-1">{t("integrity.chainedFrom")}</span>
                <span className="text-[11px] f-mono text-slate-500 break-all">{passport.previousRecordHash}</span>
              </div>
            )}
            {passport.signedAt && (
              <div className="text-[10px] f-body text-slate-500">
                {t("integrity.signed", { date: new Date(passport.signedAt).toLocaleString(locale) })}
              </div>
            )}
          </div>
        </section>

        {/* PDF Certificate of Conformity export (Circular Economy Platform
            Upgrade, Step 4) — streamed server-side by
            app/api/passports/[batchId]/certificate.pdf/route.ts, a public
            GET (no RBAC key: this is the same data already shown on this
            page, just as a signed, printable document). The PDF itself
            stays English-only for now — see lib/services/generate-certificate-pdf.tsx —
            only this page's on-screen label is localized. */}
        <a
          href={`/api/passports/${encodeURIComponent(passport.batchId)}/certificate.pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white text-xs f-body font-medium py-3 hover:bg-slate-800 transition-colors"
        >
          <FileText className="w-4 h-4" /> {t("download.pdf")}
        </a>

        <div className="text-center pt-1 pb-4">
          <a href="https://gs1.org/standards/digital-link" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] f-body text-slate-400 hover:text-slate-600">
            {t("footer.resolvedVia")} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
      )}

      <AiAssistantWidget theme="light" scope="public" contextBatchId={passport.batchId} />
    </div>
  );
}
