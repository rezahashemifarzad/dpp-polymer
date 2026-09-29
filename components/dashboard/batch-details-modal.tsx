"use client";

/**
 * components/dashboard/batch-details-modal.tsx
 * -----------------------------------------------------------------------
 * Post-creation "Manage" panel for a single passport — Batch Genealogy
 * (parent-batch linking) and the illustrative Carbon Footprint Calculator
 * (see docs/CIRCULAR_ECONOMY_PLATFORM_UPGRADE_SPEC.md §§1-2).
 *
 * Deliberately NOT folded into CreatePassportModal. Genealogy links and
 * carbon calculations both require an existing passport id (a batch can
 * only cite an *already-issued* parent, and a carbon estimate is computed
 * against a persisted polymerType), so they only ever make sense as a
 * post-creation action — exactly the same reasoning that already put
 * certifications on a separate attach-after-create endpoint rather than
 * inside the create form. Keeping this as its own modal also means the
 * creation flow (already tested, already working) stays untouched.
 *
 * Two independent panels, each posting through its own Server Action
 * (lib/actions/link-batch-genealogy.ts, lib/actions/calculate-carbon-footprint.ts)
 * via the linkParentBatch / calculateCarbonFootprint methods on
 * usePassports() — same dual-path pattern (Server Action for in-app,
 * RBAC'd REST route for external callers) used everywhere else in this
 * app.
 */

import React, { useMemo, useState } from "react";
import NextLink from "next/link";
import {
  X,
  Loader2,
  GitBranch,
  Leaf,
  AlertTriangle,
  ArrowUpRight,
  Link2,
  BadgeCheck,
  FileBadge,
  LayoutGrid,
  ArrowLeft,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/lib/hooks/use-toast";
import type { ApiPassport, ChainOfCustodyTierValue } from "@/lib/hooks/use-passports";
import { ChainOfCustodyTimeline } from "@/components/dashboard/chain-of-custody-timeline";
// Phase 4 - Step 1 (Automated Expiry & Compliance Alerts) — this modal
// previously showed no per-certification detail at all, only the
// rolled-up ledger-row badge (see app/admin/page.tsx). Reuses the same
// pure classifier and shared badge component the ledger and the
// portfolio-wide alert widget both use, so all three surfaces agree.
import { getExpiryAlertTier } from "@/lib/utils/certification-status";
import { ExpiryAlertBadge } from "@/components/dashboard/expiry-alert-badge";
// REACH SVHC & PPWR Compliance — see components/dashboard/reach-ppwr/
// reach-ppwr-panel.tsx's own file banner for why this is two independent
// forms rather than folded into the Certifications panel above.
import { ReachPpwrPanel } from "@/components/dashboard/reach-ppwr/reach-ppwr-panel";
import type { SvhcStatusValue } from "@/lib/hooks/use-passports";
// Autocomplete: previously used Chain-of-Custody participant names, so a
// repeat upstream partner's name is picked consistently instead of
// retyped (and potentially mis-spelled) on every batch. See
// lib/services/form-suggestions.ts.
import { useFormSuggestions } from "@/lib/hooks/use-form-suggestions";
// Scroll-trap fix (2026-09-29) — see lib/hooks/use-body-scroll-lock.ts.
import { useBodyScrollLock } from "@/lib/hooks/use-body-scroll-lock";

const TRANSPORT_MODES: Array<"TRUCK" | "RAIL" | "SEA" | "AIR"> = ["TRUCK", "RAIL", "SEA", "AIR"];

const COC_TIERS: Array<{ value: ChainOfCustodyTierValue; label: string }> = [
  { value: "RAW_MATERIAL_SUPPLIER", label: "Raw Material Supplier" },
  { value: "RECYCLER", label: "Recycler" },
  { value: "COMPOUNDER", label: "Compounder" },
  { value: "PROCESSOR", label: "Processor" },
  { value: "DISTRIBUTOR", label: "Distributor" },
  { value: "OTHER", label: "Other" },
];

const COC_CERT_SCHEMES = [
  "ISCC_PLUS",
  "REDCERT2",
  "ISO_14021",
  "ISO_14040_44",
  "EN_15343",
  "EN_16785",
  "GRS",
  "RECYCLASS",
  "OTHER",
];

const inputCls =
  "w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-slate-400 block mb-1">{label}</span>
      {children}
    </label>
  );
}

interface BatchDetailsModalProps {
  open: boolean;
  onClose: () => void;
  passport: ApiPassport | null;
  allPassports: ApiPassport[];
  onLinkParent: (
    childBatchId: string,
    input: { parentBatchId: string; quantityUsedKg?: number; notes?: string }
  ) => Promise<unknown>;
  onCalculateCarbon: (
    batchId: string,
    input: { weightKg: number; transportDistanceKm?: number; transportMode?: "TRUCK" | "RAIL" | "SEA" | "AIR" }
  ) => Promise<unknown>;
  onAddChainOfCustody: (
    batchId: string,
    input: {
      tier: ChainOfCustodyTierValue;
      participantName: string;
      participantCountry?: string;
      externalBatchId: string;
      certificationScheme?: string;
      certificateId?: string;
      massBalanceAllocationPercent?: number;
      notes?: string;
    }
  ) => Promise<unknown>;
  onDeclareSvhc: (
    batchId: string,
    input: {
      status: SvhcStatusValue;
      substances?: Array<{
        casNumber: string;
        substanceName: string;
        concentrationPercent: number;
        candidateListDate: string;
        safeUseInstructions?: string;
      }>;
    }
  ) => Promise<unknown>;
  onDeclarePpwr: (
    batchId: string,
    input: { recyclabilityGrade?: string; pfasCompliant?: boolean; pfasConcentrationPpb?: number }
  ) => Promise<unknown>;
  // Bug fix — "opening a passport management/edit view from the admin
  // panel still traps the user, with no top navigation bar or 'Back to
  // Admin Console' button." This modal renders `fixed inset-0 z-50`,
  // covering the entire viewport including SiteNav (which sits behind it
  // in the DOM/stacking order) — so while the small "X" in the corner did
  // technically close it, there was no persistent, clearly-labeled nav
  // affordance the way every other admin screen has. Same
  // app/page.tsx-vs-app/admin/page.tsx shared-component split as
  // QrCodeModal (see that file's own `viewedFromAdmin` prop for the
  // established convention this mirrors): true only from the admin call
  // site, so Home's copy of this modal is unchanged. When true, renders a
  // slim top bar with an explicit "Back to Admin Console" action (calls
  // onClose — there's no separate route to navigate to; this modal IS the
  // admin passport management view) above the existing content.
  viewedFromAdmin?: boolean;
}

export function BatchDetailsModal({
  open,
  onClose,
  passport,
  allPassports,
  onLinkParent,
  onCalculateCarbon,
  onAddChainOfCustody,
  onDeclareSvhc,
  onDeclarePpwr,
  viewedFromAdmin,
}: BatchDetailsModalProps) {
  const { push } = useToast();

  const [parentBatchId, setParentBatchId] = useState("");
  const [quantityUsedKg, setQuantityUsedKg] = useState("");
  const [notes, setNotes] = useState("");
  const [linking, setLinking] = useState(false);

  const [weightKg, setWeightKg] = useState("1000");
  const [transportDistanceKm, setTransportDistanceKm] = useState("0");
  const [transportMode, setTransportMode] = useState<"TRUCK" | "RAIL" | "SEA" | "AIR">("TRUCK");
  const [calculating, setCalculating] = useState(false);

  // Multi-Tier Chain of Custody (Multi-tier Supply Chain Verification &
  // Auditor Portal Expansion) — the add-tier form. Reviewing PENDING_REVIEW
  // records is deliberately NOT available here — only the authenticated
  // Auditor Portal can act on a record (see this sprint's notes for why
  // that scoping decision was made).
  const [cocTier, setCocTier] = useState<ChainOfCustodyTierValue>("RAW_MATERIAL_SUPPLIER");
  const [cocParticipantName, setCocParticipantName] = useState("");
  const [cocParticipantCountry, setCocParticipantCountry] = useState("");
  const [cocExternalBatchId, setCocExternalBatchId] = useState("");
  const [cocCertScheme, setCocCertScheme] = useState("");
  const [cocCertId, setCocCertId] = useState("");
  const [cocMassBalancePercent, setCocMassBalancePercent] = useState("");
  const [cocNotes, setCocNotes] = useState("");
  const [addingCoc, setAddingCoc] = useState(false);

  // Eligible parents: any other ISSUED-or-later passport, excluding this
  // batch itself and anything already linked. Cycle-prevention beyond that
  // (a parent that is secretly a descendant) is enforced server-side in
  // lib/services/link-batch-genealogy.ts via an ancestor walk — this list
  // is just a convenience filter, not the source of truth.
  const eligibleParents = useMemo(() => {
    if (!passport) return [];
    const alreadyLinked = new Set(passport.parentLinks.map((l) => l.parentPassport.id));
    return allPassports.filter((p) => p.id !== passport.id && !alreadyLinked.has(p.id));
  }, [passport, allPassports]);

  const { suggestions } = useFormSuggestions(open);

  // Scroll-trap fix (2026-09-29): while this modal is open, the window
  // itself must not scroll — only the modal body below does. Called before
  // the early return so hook order stays stable across renders.
  useBodyScrollLock(open && passport !== null);

  if (!open || !passport) return null;

  const handleLinkParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentBatchId) return;
    setLinking(true);
    try {
      await onLinkParent(passport.batchId, {
        parentBatchId,
        quantityUsedKg: quantityUsedKg ? Number(quantityUsedKg) : undefined,
        notes: notes || undefined,
      });
      push({
        variant: "success",
        title: "Parent batch linked",
        description: `${parentBatchId} added to ${passport.batchId}'s genealogy.`,
      });
      setParentBatchId("");
      setQuantityUsedKg("");
      setNotes("");
    } catch (err) {
      push({
        variant: "error",
        title: "Could not link parent batch",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLinking(false);
    }
  };

  const handleCalculateCarbon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCalculating(true);
    try {
      await onCalculateCarbon(passport.batchId, {
        weightKg: Number(weightKg),
        transportDistanceKm: transportDistanceKm ? Number(transportDistanceKm) : undefined,
        transportMode,
      });
      push({
        variant: "success",
        title: "Carbon footprint calculated",
        description: `Illustrative Scope 1/2/3 estimate saved for ${passport.batchId}.`,
      });
    } catch (err) {
      push({
        variant: "error",
        title: "Could not calculate carbon footprint",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setCalculating(false);
    }
  };

  const handleAddChainOfCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cocParticipantName.trim() || !cocExternalBatchId.trim()) return;
    setAddingCoc(true);
    try {
      await onAddChainOfCustody(passport.batchId, {
        tier: cocTier,
        participantName: cocParticipantName.trim(),
        participantCountry: cocParticipantCountry.trim() || undefined,
        externalBatchId: cocExternalBatchId.trim(),
        certificationScheme: cocCertScheme || undefined,
        certificateId: cocCertId.trim() || undefined,
        massBalanceAllocationPercent: cocMassBalancePercent ? Number(cocMassBalancePercent) : undefined,
        notes: cocNotes.trim() || undefined,
      });
      push({
        variant: "success",
        title: "Chain-of-custody tier added",
        description: `${cocParticipantName} added to ${passport.batchId}'s supply chain — pending auditor review.`,
      });
      setCocParticipantName("");
      setCocParticipantCountry("");
      setCocExternalBatchId("");
      setCocCertScheme("");
      setCocCertId("");
      setCocMassBalancePercent("");
      setCocNotes("");
    } catch (err) {
      push({
        variant: "error",
        title: "Could not add chain-of-custody record",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setAddingCoc(false);
    }
  };

  return (
    // Scroll-trap fix (2026-09-29) — "content exceeds the viewport height
    // and traps the user down the page; the top toolbar / admin shortcuts
    // aren't reachable." Two remaining causes, both fixed here:
    //
    // 1. This overlay was `fixed inset-0 z-50`. SiteNav is also z-50 and
    //    earlier in the DOM, so the overlay painted OVER the sticky global
    //    toolbar — Home / Admin Console / ESG shortcuts were unreachable for
    //    as long as the modal was open, no matter how the toolbar itself
    //    was positioned. The overlay now starts BELOW the global chrome
    //    (`top` = SiteNav height, or SiteNav + the admin sign-out bar on
    //    /admin — both values live in app/globals.css) and sits at z-40,
    //    so the sticky toolbar stays visible and clickable above it.
    //
    // 2. The card was capped at `max-h-[90vh]`, measured against the full
    //    viewport rather than the space actually left under the toolbar,
    //    and the page behind kept scrolling on wheel/touch (scroll
    //    chaining). The card is now `max-h-full` of the overlay (which is
    //    exactly "viewport minus toolbar"), the body is the ONLY scroll
    //    container (`min-h-0 overflow-y-auto overscroll-contain`), and the
    //    window is scroll-locked while open (useBodyScrollLock above).
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Manage Batch — ${passport.batchId}`}
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
      style={{ top: viewedFromAdmin ? "var(--admin-content-offset)" : "var(--site-nav-height)" }}
    >
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-full min-h-0 overflow-hidden">
        <div className="shrink-0 relative px-6 pt-6 pb-4 border-b border-slate-800">
          {/* Persistent, clearly-labeled return path for the admin passport
              management view (see viewedFromAdmin's own comment on
              BatchDetailsModalProps). Lives in the non-scrolling header, so
              it stays reachable no matter how far the body is scrolled. */}
          {viewedFromAdmin && (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors mb-4 -mt-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Admin Console
            </button>
          )}

          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <h3 className="text-lg font-bold text-white mb-1">Manage Batch — {passport.batchId}</h3>
          <p className="text-xs text-slate-400 font-mono">
            Supply-chain genealogy and an illustrative Scope 1/2/3 carbon footprint estimate for this batch.
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-4">
        {/* Certificate & QR panel — Phase 6 (Batch Certificate & Dynamic QR
            Generator Suite). This is the ONE insertion point shared by both
            app/page.tsx's Material Ledger tab and app/admin/page.tsx (both
            render this modal), satisfying Phase 6's "link certificate
            generation actions from... Batch Details modals" ask without a
            second copy to keep in sync — same pattern already used below
            for the Chain-of-Custody panel. Inline QR preview mirrors
            QrCodeModal's own rendering (qrcode.react's <QRCodeSVG>, same
            batch qrCodePayloadUrl) but stays small/read-only here; the
            "Open Generator Suite" link hands off to the dedicated
            /admin/generator page for the full preview/customize/print
            workflow (layout presets, copies-per-batch, bulk label sheets). */}
        <div className="border border-slate-800 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <FileBadge className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-slate-100">Certificate &amp; QR</h4>
          </div>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="p-3 bg-white rounded-xl w-fit shrink-0">
              {passport.qrCodePayloadUrl ? (
                <QRCodeSVG value={passport.qrCodePayloadUrl} size={88} bgColor="#FFFFFF" fgColor="#0f172a" level="M" />
              ) : (
                <div className="w-[88px] h-[88px] flex items-center justify-center text-slate-400 text-[9px] font-mono text-center px-2">
                  No QR link recorded
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 w-full space-y-2">
              <p className="text-[11px] text-slate-500 font-mono leading-relaxed">
                Download this batch&apos;s official compliance certificate (with embedded verification QR), or open
                the Generator Suite for print-ready label sheets and industrial layouts.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href={`/api/passports/${encodeURIComponent(passport.batchId)}/certificate.pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition text-[11px] font-mono"
                >
                  <FileBadge className="w-3.5 h-3.5" /> Download Certificate PDF
                </a>
                <NextLink
                  href={`/admin/generator?batchId=${encodeURIComponent(passport.batchId)}`}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition text-[11px] font-mono"
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Open Generator Suite
                </NextLink>
              </div>
            </div>
          </div>
        </div>

        {/* Certifications panel — Phase 4 - Step 1 (Automated Expiry &
            Compliance Alerts). Read-only: attaching/verifying a
            certification here is a separate, larger feature
            (docs/COMPLIANCE_CERTIFICATIONS_MODULE_SPEC.md §3/§4 Phase 3,
            not yet built) — this panel closes the "no certificate
            management view shows badges" gap for expiry specifically. */}
        <div className="border border-slate-800 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <BadgeCheck className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-slate-100">Certifications</h4>
          </div>
          {passport.certifications.length > 0 ? (
            <ul className="space-y-1.5 font-mono text-xs">
              {passport.certifications.map((cert) => (
                <li
                  key={cert.id}
                  className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-slate-200 font-semibold">
                      {cert.scheme} <span className="text-slate-500 font-normal">· {cert.certificateId}</span>
                    </div>
                    <div className="text-slate-500 text-[10px] mt-0.5">
                      {cert.issuingBody} · valid until {new Date(cert.validUntil).toLocaleDateString()}
                    </div>
                  </div>
                  <ExpiryAlertBadge tier={getExpiryAlertTier(cert.validUntil)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 font-mono">No certifications attached to this batch yet.</p>
          )}
        </div>

        {/* REACH Article 33 SVHC Declaration & PPWR Compliance */}
        <ReachPpwrPanel passport={passport} onDeclareSvhc={onDeclareSvhc} onDeclarePpwr={onDeclarePpwr} />

        {/* Batch Genealogy panel */}
        <div className="border border-slate-800 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-slate-100">Parent Batches (Supply-Chain Genealogy)</h4>
          </div>

          {passport.parentLinks.length > 0 ? (
            <ul className="space-y-1.5 mb-3 font-mono text-xs">
              {passport.parentLinks.map((link) => (
                <li
                  key={link.id}
                  className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                >
                  <span className="text-emerald-400">{link.parentPassport.batchId}</span>
                  <span className="text-slate-500">
                    {link.parentPassport.polymerType}
                    {link.quantityUsedKg ? ` · ${link.quantityUsedKg} kg used` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 font-mono mb-3">No parent batches linked yet.</p>
          )}

          <form onSubmit={handleLinkParent} className="space-y-3 font-mono text-xs">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Parent Batch">
                <select
                  required
                  value={parentBatchId}
                  onChange={(e) => setParentBatchId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— select a batch —</option>
                  {eligibleParents.map((p) => (
                    <option key={p.id} value={p.batchId}>
                      {p.batchId} ({p.polymerType})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quantity Used (kg, optional)">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={quantityUsedKg}
                  onChange={(e) => setQuantityUsedKg(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Notes (optional)">
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
                </Field>
              </div>
            </div>
            {eligibleParents.length === 0 && (
              <div className="flex items-center gap-1.5 text-amber-400 text-[10px]">
                <AlertTriangle className="w-3 h-3" />
                No other issued batches are available to link as a parent yet.
              </div>
            )}
            <button
              type="submit"
              disabled={linking || !parentBatchId}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              {linking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {linking ? "Linking..." : "Link Parent Batch"}
            </button>
          </form>
        </div>

        {/* Carbon Footprint panel */}
        <div className="border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-slate-100">Carbon Footprint Calculator</h4>
          </div>
          <p className="text-[10px] text-slate-500 font-mono mb-3 flex items-start gap-1.5">
            <ArrowUpRight className="w-3 h-3 mt-0.5 shrink-0" />
            Illustrative Scope 1/2/3 estimate from generic emission factors — separate from, and never
            overwrites, this batch&apos;s verified LCA figure ({passport.carbonFootprintKgCO2ePerKg} kg
            CO2e/kg).
          </p>

          {passport.carbonFootprintCalculation && (
            <div className="mb-3 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs grid grid-cols-2 gap-y-1">
              <span className="text-slate-500">Scope 1</span>
              <span className="text-slate-200 text-right">
                {passport.carbonFootprintCalculation.scope1KgCO2e} kg CO2e
              </span>
              <span className="text-slate-500">Scope 2</span>
              <span className="text-slate-200 text-right">
                {passport.carbonFootprintCalculation.scope2KgCO2e} kg CO2e
              </span>
              <span className="text-slate-500">Scope 3</span>
              <span className="text-slate-200 text-right">
                {passport.carbonFootprintCalculation.scope3KgCO2e} kg CO2e
              </span>
              <span className="text-emerald-400 font-bold">Total</span>
              <span className="text-emerald-400 font-bold text-right">
                {passport.carbonFootprintCalculation.totalKgCO2e} kg CO2e
              </span>
            </div>
          )}

          <form onSubmit={handleCalculateCarbon} className="space-y-3 font-mono text-xs">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Weight (kg)">
                <input
                  required
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Transport Distance (km)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={transportDistanceKm}
                  onChange={(e) => setTransportDistanceKm(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Transport Mode">
                <select
                  value={transportMode}
                  onChange={(e) => setTransportMode(e.target.value as "TRUCK" | "RAIL" | "SEA" | "AIR")}
                  className={inputCls}
                >
                  {TRANSPORT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button
              type="submit"
              disabled={calculating}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              {calculating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {calculating
                ? "Calculating..."
                : passport.carbonFootprintCalculation
                  ? "Recalculate"
                  : "Calculate Footprint"}
            </button>
          </form>
        </div>

        {/* Multi-Tier Chain of Custody panel (Multi-tier Supply Chain
            Verification & Auditor Portal Expansion) — this is the ONE
            insertion point shared by both app/page.tsx's Material Ledger
            tab and app/admin/page.tsx, since both render this modal, so a
            batch managed from either surface gets the same chain-of-custody
            UI without a second copy to keep in sync. */}
        <div className="border border-slate-800 rounded-2xl p-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-slate-100">Multi-Tier Chain of Custody</h4>
          </div>
          <p className="text-[10px] text-slate-500 font-mono mb-3">
            Upstream suppliers, recyclers, and compounders for this batch. New tiers start PENDING_REVIEW —
            only the Auditor Portal can verify, flag, or reject them.
          </p>

          <div className="mb-3">
            <ChainOfCustodyTimeline
              records={passport.chainOfCustodyRecords}
              mode="readonly"
              emptyLabel="No chain-of-custody tiers linked yet."
            />
          </div>

          <form onSubmit={handleAddChainOfCustody} className="space-y-3 font-mono text-xs">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tier / Role">
                <select
                  value={cocTier}
                  onChange={(e) => setCocTier(e.target.value as ChainOfCustodyTierValue)}
                  className={inputCls}
                >
                  {COC_TIERS.map((tier) => (
                    <option key={tier.value} value={tier.value}>
                      {tier.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Participant Name">
                <input
                  required
                  list="coc-participant-name-suggestions"
                  value={cocParticipantName}
                  onChange={(e) => setCocParticipantName(e.target.value)}
                  className={inputCls}
                  autoComplete="off"
                />
                <datalist id="coc-participant-name-suggestions">
                  {suggestions.chainOfCustodyParticipantNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </Field>
              <Field label="Participant Country (optional)">
                <input
                  value={cocParticipantCountry}
                  onChange={(e) => setCocParticipantCountry(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Their Batch ID">
                <input
                  required
                  value={cocExternalBatchId}
                  onChange={(e) => setCocExternalBatchId(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Certification Scheme (optional)">
                <select value={cocCertScheme} onChange={(e) => setCocCertScheme(e.target.value)} className={inputCls}>
                  <option value="">— none —</option>
                  {COC_CERT_SCHEMES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Certificate ID (optional)">
                <input value={cocCertId} onChange={(e) => setCocCertId(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Mass Balance Allocation % (optional)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={cocMassBalancePercent}
                  onChange={(e) => setCocMassBalancePercent(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Notes (optional)">
                  <input value={cocNotes} onChange={(e) => setCocNotes(e.target.value)} className={inputCls} />
                </Field>
              </div>
            </div>
            <button
              type="submit"
              disabled={addingCoc || !cocParticipantName.trim() || !cocExternalBatchId.trim()}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              {addingCoc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {addingCoc ? "Adding..." : "Add Chain-of-Custody Tier"}
            </button>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}
