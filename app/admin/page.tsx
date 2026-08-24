"use client";

/**
 * app/admin/page.tsx
 * -----------------------------------------------------------------------
 * "DPP Industrial Admin Console" — root-cause fix.
 *
 * The previous version of this file (never seen by the Step 5 work until
 * a direct read of the live repo) had its own bespoke inline form with
 * fields { gradeName, polymerType, pcrPercentage, mfi, density, supplier }
 * and posted that shape straight to POST /api/passports. That payload
 * shares almost no field names with PolymerPassportInputSchema (lib/types.ts)
 * — no gtin, no batchId, no manufacturerId, no certifications — so every
 * submission from this page was guaranteed to 400 with "Validation failed"
 * regardless of anything done to the API route or to the *other*,
 * already-correct form component (components/dashboard/create-passport-modal.tsx),
 * because this page never rendered that component in the first place.
 *
 * Fix: this page now uses the exact same data layer and form as the root
 * dashboard (app/page.tsx) — usePassports() + <CreatePassportModal /> —
 * instead of a second, independently-maintained, incompatible copy. One
 * form, one validation path, one place that can drift out of sync with
 * the schema. The "Direct Link" column now points at the real stored
 * qrCodePayloadUrl (the GS1 Digital Link built by lib/qr.ts and persisted
 * atomically with the passport) instead of a hardcoded `/passport/${id}`
 * route that doesn't exist anywhere in this app.
 */

import { useMemo, useState } from "react";
import {
  ShieldCheck,
  PlusCircle,
  Database,
  QrCode,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Layers,
  Settings2,
  BarChart3,
  KeyRound,
  Building2,
  Coins,
  Printer,
  FileSpreadsheet,
  Loader2,
  ScrollText,
  LayoutGrid,
} from "lucide-react";
import Link from "next/link";
import { ToastProvider, useToast } from "@/lib/hooks/use-toast";
import { usePassports, type ApiPassport } from "@/lib/hooks/use-passports";
import { CreatePassportModal } from "@/components/dashboard/create-passport-modal";
import { BatchDetailsModal } from "@/components/dashboard/batch-details-modal";
// Sprint 2.2 (Dynamic QR Code Engine & Factory Batch Labeling) — this page
// is the *other* independent Material Ledger UI (see
// claude/circular-economy-platform-upgrade-notes.md's "two independent
// Material Ledger tables" note); it previously had no QR preview at all,
// only the bare "View ↗" link below. Both modals are the same reusable
// components already wired into app/page.tsx.
import { QrCodeModal } from "@/components/dashboard/qr-code-modal";
import { QrLabelSheetModal, type QrLabelCandidate } from "@/components/dashboard/qr-label-sheet-modal";
// Phase 4 - Step 1 (Automated Expiry & Compliance Alerts) — portfolio-wide
// widget, and the shared badge it (and the Material Ledger's own
// "Compliance" column below) both use for consistent styling.
import { ExpiryAlertBanner } from "@/components/dashboard/expiry-alert-banner";
import { ExpiryAlertBadge } from "@/components/dashboard/expiry-alert-badge";
// Phase 4 - Step 2 (Supplier Onboarding Portal) — review queue + invite
// management widget, same "portfolio-wide widget below the header" slot
// as ExpiryAlertBanner above.
import { SupplierReviewPanel } from "@/components/dashboard/supplier-review-panel";

function AdminDashboardInner() {
  const {
    data: passports,
    loading,
    refetch,
    createPassport,
    linkParentBatch,
    calculateCarbonFootprint,
    addChainOfCustodyRecord,
  } = usePassports();
  const { push } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [manageTarget, setManageTarget] = useState<ApiPassport | null>(null);
  // Sprint 2.3 (Enterprise Compliance Reporting & PDF/Excel Export Module)
  // — "Download Ledger Excel" fetch+blob round trip, same convention as
  // app/page.tsx's handleExportLedgerExcel.
  const [exportingLedger, setExportingLedger] = useState(false);

  // Sprint 2.2 — single-batch QR preview/download, and the bulk
  // print-ready label sheet picker. Separate state from manageTarget above:
  // "Manage" and "QR" are two independent actions on a row.
  const [qrTarget, setQrTarget] = useState<ApiPassport | null>(null);
  const [showLabelSheetModal, setShowLabelSheetModal] = useState(false);

  // Normalized shape for QrLabelSheetModal (page-shape-agnostic — see that
  // component's file banner for why it doesn't take ApiPassport directly).
  const qrLabelCandidates: QrLabelCandidate[] = useMemo(
    () =>
      passports.map((p) => ({
        id: p.id,
        batchId: p.batchId,
        label: p.grade,
        polymerType: p.polymerType,
        gtin: p.gtin,
        qrUrl: p.qrCodePayloadUrl,
      })),
    [passports]
  );

  // Sprint 2.3 — fetch+blob (not a bare <a href> click) so a genuine
  // server-side failure surfaces as a toast instead of silently opening a
  // JSON error body as if it were the workbook.
  const handleExportLedgerExcel = async () => {
    setExportingLedger(true);
    try {
      const res = await fetch("/api/passports/ledger-export.xlsx");
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `polymer-dpp-ledger-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      push({ variant: "success", title: "Ledger Excel exported", description: "Material Ledger + Audit Trail workbook downloaded." });
    } catch (err) {
      push({
        variant: "error",
        title: "Excel export failed",
        description: err instanceof Error ? err.message : "Failed to generate the ledger workbook.",
      });
    } finally {
      setExportingLedger(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans overflow-x-hidden">
      {/* Header — stacks title above the action-link row below md so four
          pill links never force horizontal overflow on a phone; the link
          row itself also wraps (flex-wrap) as a safety net for the
          in-between widths where four links still don't fit one line even
          after stacking. */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 mb-8 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-wide">DPP Industrial Admin Console</h1>
            <p className="text-xs text-slate-400">Compounder &amp; Material Lifecycle Management (ESPR Compliance)</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/esg-analytics"
            className="flex items-center gap-2 text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg transition-all"
          >
            <BarChart3 className="w-4 h-4" />
            ESG Analytics
          </Link>
          <Link
            href="/auditor"
            className="flex items-center gap-2 text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-lg transition-all"
          >
            <KeyRound className="w-4 h-4" />
            Auditor Portal
          </Link>
          <Link
            href="/client-portal"
            className="flex items-center gap-2 text-xs font-medium bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 px-4 py-2 rounded-lg transition-all"
          >
            <Building2 className="w-4 h-4" />
            Client Portal
          </Link>
          <Link
            href="/admin/green-accounting"
            className="flex items-center gap-2 text-xs font-medium bg-lime-500/10 hover:bg-lime-500/20 border border-lime-500/30 text-lime-400 px-4 py-2 rounded-lg transition-all"
          >
            <Coins className="w-4 h-4" />
            Green Accounting
          </Link>
          <Link
            href="/admin/audit"
            className="flex items-center gap-2 text-xs font-medium bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-400 px-4 py-2 rounded-lg transition-all"
          >
            <ScrollText className="w-4 h-4" />
            Audit Log
          </Link>
          {/* Phase 6 (Batch Certificate & Dynamic QR Generator Suite) —
              same nav-pill slot as every other /admin/* destination above;
              added here AND to app/page.tsx's own nav row per the "two
              independent Material Ledger UIs" rule (a QR/labeling-related
              UI change reaches both — see qr-code-modal.tsx's banner). */}
          <Link
            href="/admin/generator"
            className="flex items-center gap-2 text-xs font-medium bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-400 px-4 py-2 rounded-lg transition-all"
          >
            <LayoutGrid className="w-4 h-4" />
            Generator Suite
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Public View
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Phase 4 - Step 1 — Automated Expiry & Compliance Alerts.
            Portfolio-wide widget, first thing an admin sees below the
            header: expired/urgent/soon counts, an expandable detail list,
            and a manual "Run Check Now" trigger for the background check
            that otherwise runs on Vercel Cron's daily schedule. */}
        <ExpiryAlertBanner />

        {/* Phase 4 - Step 2 — Supplier Onboarding Portal. Pending
            submission review queue plus "Invite Supplier" / "Manage
            Invites" controls. */}
        <SupplierReviewPanel />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Issue action */}
          <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md flex flex-col items-start justify-center gap-4">
            <div className="flex items-center justify-between w-full">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                Issue New Digital Passport
              </h2>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Neon DB Sync
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Opens the full, schema-validated intake form — every field required by
              PolymerPassportInputSchema (GTIN, batch ID, manufacturer, certification, etc.) is
              collected here, so submissions from this console can never hit "Validation failed"
              for a field this page silently omitted.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold py-2.5 px-5 rounded-lg text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              Issue Digital Passport
            </button>
          </div>

          {/* System Info */}
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                PostgreSQL Connectivity
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Database:</span>
                  <span className="font-mono text-emerald-400">Neon Cloud DB</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Schema Model:</span>
                  <span className="text-slate-200">PolymerPassport</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-400">Compliance Standard:</span>
                  <span className="text-emerald-400 font-medium">EU ESPR 2026</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Material Ledger Table */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
            <div className="min-w-0">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                Material Ledger &amp; Active Passports
              </h3>
              <p className="text-xs text-slate-400 mt-1">Live data records synchronized with Neon DB</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-all shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                onClick={() => setShowLabelSheetModal(true)}
                className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-all shrink-0"
                title="Generate a print-ready QR label sheet"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Labels
              </button>
              <button
                onClick={handleExportLedgerExcel}
                disabled={exportingLedger}
                className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 px-3 py-1.5 rounded-lg transition-all shrink-0"
                title="Download the Material Ledger & Audit Trail as an Excel workbook"
              >
                {exportingLedger ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                {exportingLedger ? "Exporting..." : "Download Ledger Excel"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">Batch ID</th>
                  <th className="p-3">Grade Name</th>
                  <th className="p-3 text-center">Polymer</th>
                  <th className="p-3 text-center">Recycled %</th>
                  <th className="p-3 text-center">MFI</th>
                  <th className="p-3 text-center">Density</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Compliance</th>
                  <th className="p-3 text-center">Direct Link</th>
                  <th className="p-3 text-center">Genealogy / Carbon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {passports.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center p-6 text-slate-500">
                      {loading ? "Fetching records from database..." : "No passports issued yet. Create your first passport above."}
                    </td>
                  </tr>
                ) : (
                  passports.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono font-medium text-emerald-400">{item.batchId}</td>
                      <td className="p-3 font-medium text-slate-100">{item.grade}</td>
                      <td className="p-3 text-center font-semibold">{item.polymerType}</td>
                      <td className="p-3 text-center">
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                          {item.recycledContentPercent}%
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono">{item.meltFlowIndex}</td>
                      <td className="p-3 text-center font-mono">{item.density}</td>
                      <td className="p-3 text-center">
                        <span className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <ExpiryAlertBadge
                          tier={item.certificationAlert.level}
                          count={
                            item.certificationAlert.level === "EXPIRED"
                              ? item.certificationAlert.expiredCount
                              : item.certificationAlert.level === "EXPIRING_SOON"
                                ? item.certificationAlert.expiringSoonCount
                                : undefined
                          }
                          title={
                            item.certificationAlert.level === "EXPIRED"
                              ? `${item.certificationAlert.expiredCount} certification(s) past their validUntil date`
                              : item.certificationAlert.level === "EXPIRING_SOON"
                                ? `${item.certificationAlert.expiringSoonCount} certification(s) expiring within 30 days`
                                : undefined
                          }
                        />
                      </td>
                      <td className="p-3 text-center">
                        {item.qrCodePayloadUrl ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => setQrTarget(item)}
                              className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-lg transition-all"
                              title="Preview & download QR code"
                            >
                              <QrCode className="w-3 h-3" />
                            </button>
                            <Link
                              href={item.qrCodePayloadUrl}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                            >
                              View <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setManageTarget(item)}
                          className="inline-flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg transition-all"
                        >
                          <Settings2 className="w-3 h-3" />
                          Manage
                          {(item.parentLinks.length > 0 || item.carbonFootprintCalculation) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <CreatePassportModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => refetch()}
        onCreate={createPassport}
      />

      <BatchDetailsModal
        open={manageTarget !== null}
        onClose={() => setManageTarget(null)}
        // Re-derive from the live list rather than holding a stale snapshot
        // — after linkParentBatch / calculateCarbonFootprint each refetch()
        // the list, so this keeps the modal showing the just-saved state.
        passport={manageTarget ? passports.find((p) => p.id === manageTarget.id) ?? null : null}
        allPassports={passports}
        onLinkParent={linkParentBatch}
        onCalculateCarbon={calculateCarbonFootprint}
        onAddChainOfCustody={addChainOfCustodyRecord}
      />

      {/* Sprint 2.2 — single-batch QR preview/download (this page had none
          before) and the bulk print-ready label sheet picker. */}
      <QrCodeModal
        open={qrTarget !== null}
        onClose={() => setQrTarget(null)}
        batchId={qrTarget?.batchId ?? ""}
        label={qrTarget?.grade ?? ""}
        qrUrl={qrTarget?.qrCodePayloadUrl ?? null}
        details={
          qrTarget
            ? [
                { label: "Record Hash (SHA-256)", value: qrTarget.recordHash ?? "—", title: qrTarget.recordHash ?? undefined },
                { label: "Total Recycled Content", value: `${qrTarget.recycledContentPercent}%` },
                { label: "Certification", value: qrTarget.certifications[0]?.scheme ?? "—" },
              ]
            : []
        }
      />

      <QrLabelSheetModal
        open={showLabelSheetModal}
        onClose={() => setShowLabelSheetModal(false)}
        passports={qrLabelCandidates}
      />
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <ToastProvider>
      <AdminDashboardInner />
    </ToastProvider>
  );
}
