/**
 * app/portal/customer/page.tsx
 * -----------------------------------------------------------------------
 * Session-based Customer Portal — Role-Based Authentication & Client/
 * Auditor Portal Suite. Reuses lib/services/get-client-portfolio.ts's
 * getClientPortfolio() UNCHANGED (already the shared implementation behind
 * both the legacy /client-portal page and the Buyer API) — no new data
 * logic needed here, only a new session-authenticated entry point to it.
 *
 * Auth: requireClientSession() (lib/session-auth.ts) resolves the session
 * cookie to an active Client or redirects to /login — the real boundary,
 * not middleware.ts (see that file's own banner).
 */

import Link from "next/link";
import { Building2, LogOut, Boxes, ShieldCheck, Percent, Package, Factory, Download, ExternalLink, ArrowLeft } from "lucide-react";
import { requireClientSession } from "@/lib/session-auth";
import { getClientPortfolio } from "@/lib/services/get-client-portfolio";
import { logoutAction } from "@/lib/actions/logout";
import { AiAssistantWidget } from "@/components/dashboard/ai-assistant-widget";

const STATUS_BADGE: Record<string, string> = {
  ISSUED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PENDING_VERIFICATION: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  DRAFT: "bg-slate-800 text-slate-400 border-slate-700",
  REVOKED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  SUPERSEDED: "bg-slate-800 text-slate-500 border-slate-700",
};

function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
  sub,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-2xl font-bold text-slate-100">
        {value} {unit && <span className="text-sm font-normal text-slate-500">{unit}</span>}
      </div>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export default async function CustomerPortalPage() {
  const client = await requireClientSession();
  const portfolio = await getClientPortfolio(client.id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans overflow-x-hidden">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 mb-6 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-wide">Customer Portal</h1>
            <p className="text-xs text-slate-400">
              <span className="text-cyan-400 font-medium">{client.companyName}</span>
              {client.country ? ` · ${client.country}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/portal/customer"
            className="flex items-center gap-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg transition-all"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {!portfolio ? (
          <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">
            Could not load your account's purchased batches. Please try again shortly.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={Boxes} label="Purchased Batches" value={String(portfolio.totalBatches)} />
              <KpiCard
                icon={ShieldCheck}
                label="Verified & Issued"
                value={`${portfolio.verifiedBatchesPercent}%`}
                sub={`of ${portfolio.totalBatches} batches`}
              />
              <KpiCard
                icon={Percent}
                label="PCR Adoption Rate"
                value={`${portfolio.pcrMass.pcrAdoptionRatePercent}%`}
                sub={
                  portfolio.pcrMass.batchesMissingWeightData > 0
                    ? `${portfolio.pcrMass.batchesMissingWeightData} batch(es) missing weight data`
                    : "across weighed batches"
                }
              />
              <KpiCard
                icon={Package}
                label="Total PCR Mass"
                value={portfolio.pcrMass.pcrMassKg.toLocaleString()}
                unit="kg"
                sub={`of ${portfolio.pcrMass.totalMassKg.toLocaleString()} kg total weighed`}
              />
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold mb-4">Purchased Batches</h2>
              {portfolio.batches.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  No batches have been allocated to your account yet. Contact your Polymer-DPP account
                  manager to have your purchases linked here.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-3">Batch ID</th>
                        <th className="p-3">Polymer / Grade</th>
                        <th className="p-3">Manufacturer</th>
                        <th className="p-3 text-center">Recycled %</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Public Passport</th>
                        <th className="p-3 text-center">Certificate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {portfolio.batches.map((b) => (
                        <tr key={b.batchId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-mono font-medium text-cyan-400">{b.batchId}</td>
                          <td className="p-3">
                            <div className="text-slate-100">{b.polymerType}</div>
                            <div className="text-[10px] text-slate-500">{b.grade}</div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1 text-slate-300">
                              <Factory className="w-3 h-3" /> {b.manufacturer.legalName}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                              {b.recycledContentPercent}%
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[b.status] ?? STATUS_BADGE.DRAFT}`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {b.qrCodePayloadUrl ? (
                              <Link
                                href={b.qrCodePayloadUrl}
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
                            <a
                              href={b.certificatePdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg transition-all"
                            >
                              <Download className="w-3 h-3" /> PDF
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <AiAssistantWidget theme="dark" scope="public" />
    </div>
  );
}
