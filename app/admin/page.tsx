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

import { useState } from "react";
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
} from "lucide-react";
import Link from "next/link";
import { ToastProvider } from "@/lib/hooks/use-toast";
import { usePassports, type ApiPassport } from "@/lib/hooks/use-passports";
import { CreatePassportModal } from "@/components/dashboard/create-passport-modal";
import { BatchDetailsModal } from "@/components/dashboard/batch-details-modal";

function AdminDashboardInner() {
  const { data: passports, loading, refetch, createPassport, linkParentBatch, calculateCarbonFootprint } =
    usePassports();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [manageTarget, setManageTarget] = useState<ApiPassport | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex justify-between items-center pb-6 mb-8 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide">DPP Industrial Admin Console</h1>
            <p className="text-xs text-slate-400">Compounder &amp; Material Lifecycle Management (ESPR Compliance)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
            href="/"
            className="flex items-center gap-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Public View
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
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
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                Material Ledger &amp; Active Passports
              </h3>
              <p className="text-xs text-slate-400 mt-1">Live data records synchronized with Neon DB</p>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
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
                        {item.certificationAlert.level === "EXPIRED" ? (
                          <span
                            className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-semibold"
                            title={`${item.certificationAlert.expiredCount} certification(s) past their validUntil date`}
                          >
                            Expired ({item.certificationAlert.expiredCount})
                          </span>
                        ) : item.certificationAlert.level === "EXPIRING_SOON" ? (
                          <span
                            className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold"
                            title={`${item.certificationAlert.expiringSoonCount} certification(s) expiring within 30 days`}
                          >
                            Expiring Soon ({item.certificationAlert.expiringSoonCount})
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {item.qrCodePayloadUrl ? (
                          <Link
                            href={item.qrCodePayloadUrl}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </Link>
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
