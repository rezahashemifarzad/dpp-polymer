/**
 * app/portal/auditor/page.tsx
 * -----------------------------------------------------------------------
 * Session-based Auditor Portal — Role-Based Authentication & Client/
 * Auditor Portal Suite. A read-only view of the shared PENDING_VERIFICATION
 * review queue for a signed-in Auditor (via /login), plus the public-scope
 * AI assistant.
 *
 * Deliberately read-only: the formal sign-off actions (approve/reject with
 * a digitally-signed decision) stay on the existing /auditor page, which
 * authenticates with the auditor's own personal API key — that key is
 * exactly the credential AuditorVerification.signatureHash's tamper-evidence
 * story depends on being personally held by the signer, not something this
 * new cookie-session flow re-derives. This portal is the "securely view
 * relevant batch data" half of the request; /auditor remains the place to
 * actually sign.
 *
 * Auth: requireAuditorSession() (lib/session-auth.ts) resolves the session
 * cookie to an active Auditor or redirects to /login — this is the real
 * boundary, not middleware.ts (see that file's own banner).
 */

import Link from "next/link";
import { ShieldCheck, LogOut, ClipboardList, Inbox, Factory, Gauge, Recycle, Leaf, BadgeCheck, ArrowLeft } from "lucide-react";
import { requireAuditorSession } from "@/lib/session-auth";
import { getAuditorQueue } from "@/lib/services/get-auditor-queue";
import { logoutAction } from "@/lib/actions/logout";
import { AiAssistantWidget } from "@/components/dashboard/ai-assistant-widget";

export default async function AuditorPortalPage() {
  const auditor = await requireAuditorSession();
  const queue = await getAuditorQueue();

  const rows = queue.map((p) => ({
    id: p.id,
    batchId: p.batchId,
    gtin: p.gtin,
    polymerType: p.polymerType,
    grade: p.grade,
    meltFlowIndex: p.meltFlowIndex.toString(),
    density: p.density.toString(),
    recycledContentPercent: p.recycledContentPercent.toString(),
    carbonFootprintKgCO2ePerKg: p.carbonFootprintKgCO2ePerKg.toString(),
    productionDate: p.productionDate.toLocaleDateString(),
    manufacturerName: p.manufacturer?.legalName ?? "Unknown",
    manufacturerCountry: p.manufacturer?.country ?? "",
    certificationsTotal: p.certifications.length,
    certificationsVerified: p.certifications.filter((c) => c.verificationStatus === "VERIFIED").length,
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans overflow-x-hidden">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 mb-6 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-teal-500/10 text-teal-400 rounded-lg border border-teal-500/20 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-wide">Auditor Portal</h1>
            <p className="text-xs text-slate-400">
              Signed in as <span className="text-teal-400 font-medium">{auditor.name}</span> · {auditor.organization}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/portal/auditor"
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

      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <ClipboardList className="w-4 h-4 text-teal-400" />
          Review Queue ({rows.length})
        </div>
        <p className="text-xs text-slate-500 -mt-2">
          A read-only view of batches awaiting review. To formally verify or reject a batch, use your
          personal auditor key at the{" "}
          <Link href="/auditor" className="text-teal-400 hover:text-teal-300">
            Auditor Portal sign-off workflow
          </Link>
          .
        </p>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-slate-900/60 border border-slate-800 border-dashed rounded-xl text-slate-600 gap-2">
            <Inbox className="w-8 h-8" />
            <p className="text-xs">No batches awaiting review.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((p) => (
              <div key={p.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">
                      {p.polymerType} · {p.grade}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 truncate">{p.batchId}</div>
                  </div>
                  <span className="shrink-0 text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                    PENDING
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Factory className="w-3 h-3 shrink-0" /> {p.manufacturerName}
                  {p.manufacturerCountry ? ` · ${p.manufacturerCountry}` : ""}
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="rounded-lg bg-slate-950 border border-slate-800 p-2">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Gauge className="w-2.5 h-2.5" /> MFI
                    </div>
                    <div className="font-mono text-slate-200 mt-0.5">{p.meltFlowIndex}</div>
                  </div>
                  <div className="rounded-lg bg-slate-950 border border-slate-800 p-2">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Recycle className="w-2.5 h-2.5" /> Recycled
                    </div>
                    <div className="font-mono text-emerald-400 mt-0.5">{p.recycledContentPercent}%</div>
                  </div>
                  <div className="rounded-lg bg-slate-950 border border-slate-800 p-2">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Leaf className="w-2.5 h-2.5" /> CO₂e/kg
                    </div>
                    <div className="font-mono text-slate-200 mt-0.5">{p.carbonFootprintKgCO2ePerKg}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                  <span className="flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3" /> {p.certificationsVerified}/{p.certificationsTotal} verified
                  </span>
                  <span>{p.productionDate}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AiAssistantWidget theme="dark" scope="public" />
    </div>
  );
}
