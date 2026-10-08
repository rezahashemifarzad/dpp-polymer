"use client";

/**
 * app/client-portal/page.tsx
 * -----------------------------------------------------------------------
 * B2B Client Portal — the buyer-facing counterpart to the Auditor Portal
 * (app/auditor/page.tsx), which this file's structure deliberately
 * mirrors: a sessionStorage-backed personal/company API key gate, no
 * login page, no session cookie. See lib/client-auth.ts and
 * app/auditor/page.tsx's own file banner for the full rationale — the
 * same trade-offs apply here (a bearer key the buyer types in themselves,
 * not a server secret to hide from the browser, so direct client-side
 * fetch() calls with the key as a header are appropriate).
 *
 * An industrial buyer signs in once per tab with the company API key
 * provisioned via scripts/create-client.ts, then sees every batch
 * allocated to them (scripts/allocate-passport-to-client.ts or POST
 * /api/admin/client-purchases), consolidated compliance/PCR metrics, and
 * a certificate download link per batch. The same data is available
 * programmatically at GET /api/v1/client/passports for their ERP.
 */

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  ShieldCheck, KeyRound, Loader2, LogOut, RefreshCw,
  AlertTriangle, Building2, Package, Percent, Download, ExternalLink,
  CalendarDays, Factory, Boxes, Link2, ChevronDown, ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { MainSiteLink } from "@/components/main-site-link";
import { ChainOfCustodyTimeline, type ChainOfCustodyTimelineRecord } from "@/components/dashboard/chain-of-custody-timeline";

const SESSION_KEY_STORAGE = "dpp-client-key";
const CLIENT_KEY_HEADER = "x-dpp-client-key";

/* ---------------------------------------------------------------------------
 * Types — mirror ClientPortfolioSummary / ClientPortfolioBatch from
 * lib/services/get-client-portfolio.ts (Decimal fields already converted
 * to numbers server-side, per that module's own return type — unlike
 * lib/hooks/use-passports.ts's raw Prisma-serialized shape, this endpoint
 * is purpose-built for buyer consumption, so it hands back plain numbers).
 * ------------------------------------------------------------------------*/
interface ClientIdentity {
  id: string;
  companyName: string;
  country: string | null;
}

interface PortfolioBatch {
  batchId: string;
  gtin: string;
  polymerType: string;
  grade: string;
  status: string;
  recycledContentSource: string | null;
  recycledContentPercent: number;
  bioBasedPercent: number;
  carbonFootprintKgCO2ePerKg: number;
  lcaThirdPartyVerified: boolean;
  productionDate: string;
  manufacturer: { legalName: string; country: string };
  quantityKg: number | null;
  purchaseDate: string;
  notes: string | null;
  verifiedCertifications: number;
  totalCertifications: number;
  certificationAlert: { level: "EXPIRED" | "EXPIRING_SOON" | null; expiredCount: number; expiringSoonCount: number };
  qrCodePayloadUrl: string | null;
  certificatePdfUrl: string;
  chainOfCustody: Array<{
    id: string;
    sequence: number;
    tier: string;
    participantName: string;
    participantCountry: string | null;
    externalBatchId: string;
    certificationScheme: string | null;
    massBalanceAllocationPercent: number | null;
    reviewedAt: string | null;
  }>;
}

interface PortfolioSummary {
  generatedAt: string;
  client: { id: string; companyName: string; country: string | null };
  totalBatches: number;
  statusBreakdown: Record<string, number>;
  pcrMass: {
    batchesConsidered: number;
    batchesWithWeightData: number;
    batchesMissingWeightData: number;
    totalMassKg: number;
    pcrMassKg: number;
    pcrAdoptionRatePercent: number;
  };
  verifiedBatchesPercent: number;
  batches: PortfolioBatch[];
}

/* ---------------------------------------------------------------------------
 * Key-entry gate — structurally identical to app/auditor/page.tsx's
 * AuditorGate, pointed at the client-side auth endpoints instead.
 * ------------------------------------------------------------------------*/
function ClientGate({ onAuthenticated }: { onAuthenticated: (key: string, identity: ClientIdentity) => void }) {
  const [keyInput, setKeyInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyInput.trim();
    if (!trimmed) return;

    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/client/me", { headers: { [CLIENT_KEY_HEADER]: trimmed } });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setError(body?.error ?? "That key was not recognized. Check it and try again.");
        return;
      }
      onAuthenticated(trimmed, body.data as ClientIdentity);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide">Client Portal</h1>
            <p className="text-xs text-slate-400">B2B Buyer Sign-in</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-4 mb-4 font-mono leading-relaxed">
          Enter your company&apos;s API key. It is held only in this browser tab&apos;s session storage —
          never saved, never sent anywhere but this portal — and clears automatically when the tab
          closes. The same key authenticates ERP requests to /api/v1/client/passports.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            autoFocus
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Company API key"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
          {error && (
            <div className="flex items-start gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={checking || !keyInput.trim()}
            className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold py-2.5 rounded-lg text-sm transition-all"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Sign In
          </button>
        </form>
        <div className="mt-5 pt-4 border-t border-slate-800 text-center">
          <MainSiteLink />
        </div>
      </div>
    </div>
  );
}

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

const STATUS_BADGE: Record<string, string> = {
  ISSUED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PENDING_VERIFICATION: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  DRAFT: "bg-slate-800 text-slate-400 border-slate-700",
  REVOKED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  SUPERSEDED: "bg-slate-800 text-slate-500 border-slate-700",
};

/* ---------------------------------------------------------------------------
 * Main portal (post-authentication)
 * ------------------------------------------------------------------------*/
function ClientPortal({
  clientKey,
  identity,
  onSignOut,
}: {
  clientKey: string;
  identity: ClientIdentity;
  onSignOut: () => void;
}) {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Multi-tier Supply Chain Verification & Auditor Portal Expansion — which
  // batch row's chain-of-custody timeline is expanded, at most one at a
  // time (a simple accordion, not a per-row toggle set — this table can
  // already run long, and only one buyer-side supply chain is usually
  // being inspected at once).
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/client/passports", { headers: { [CLIENT_KEY_HEADER]: clientKey } });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setError(body?.error ?? "Failed to load your purchased batches.");
        return;
      }
      setPortfolio(body.data as PortfolioSummary);
    } catch {
      setError("Could not reach the server while loading your batches.");
    } finally {
      setLoading(false);
    }
  }, [clientKey]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans overflow-x-hidden">
      {/* Header — stacks below md; the company-name identity line has no
          length limit (buyer-supplied at provisioning time), so it and the
          two action buttons are given their own rows on narrow screens
          instead of being squeezed into one. */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 mb-6 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-wide">Client Portal</h1>
            <p className="text-xs text-slate-400">
              <span className="text-cyan-400 font-medium">{identity.companyName}</span>
              {identity.country ? ` · ${identity.country}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchPortfolio()}
            className="flex items-center gap-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs border bg-rose-500/10 border-rose-500/20 text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}

        {loading && !portfolio ? (
          <div className="flex items-center justify-center py-20 text-slate-500 text-sm gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading your purchased batches...
          </div>
        ) : portfolio ? (
          <>
            {/* KPI cards */}
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

            {/* Batch table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold mb-4">Purchased Batches</h2>
              {portfolio.batches.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  No batches have been allocated to your account yet. Contact your DPP-Polymer account
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
                        <th className="p-3 text-center">Quantity</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Certifications</th>
                        <th className="p-3 text-center">Public Passport</th>
                        <th className="p-3 text-center">Certificate</th>
                        <th className="p-3 text-center">Chain of Custody</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {portfolio.batches.map((b) => (
                        <Fragment key={b.batchId}>
                        <tr className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-mono font-medium text-cyan-400">{b.batchId}</td>
                          <td className="p-3">
                            <div className="text-slate-100">{b.polymerType}</div>
                            <div className="text-[10px] text-slate-500">{b.grade}</div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1 text-slate-300">
                              <Factory className="w-3 h-3" /> {b.manufacturer.legalName}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <CalendarDays className="w-3 h-3" /> Purchased {new Date(b.purchaseDate).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                              {b.recycledContentPercent}%
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono">{b.quantityKg ? `${b.quantityKg} kg` : "—"}</td>
                          <td className="p-3 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[b.status] ?? STATUS_BADGE.DRAFT}`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {b.certificationAlert.level === "EXPIRED" ? (
                              <span
                                className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full font-semibold"
                                title={`${b.certificationAlert.expiredCount} verified certification(s) past their validUntil date`}
                              >
                                Expired
                              </span>
                            ) : b.certificationAlert.level === "EXPIRING_SOON" ? (
                              <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold">
                                Expiring Soon
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">
                                {b.verifiedCertifications}/{b.totalCertifications} verified
                              </span>
                            )}
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
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setExpandedBatchId(expandedBatchId === b.batchId ? null : b.batchId)}
                              disabled={b.chainOfCustody.length === 0}
                              className="inline-flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 px-2.5 py-1 rounded-lg transition-all"
                            >
                              <Link2 className="w-3 h-3" /> {b.chainOfCustody.length}
                              {expandedBatchId === b.batchId ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          </td>
                        </tr>
                        {expandedBatchId === b.batchId && (
                          <tr>
                            <td colSpan={9} className="p-3 bg-slate-950/60">
                              <div className="max-w-2xl">
                                <ChainOfCustodyTimeline
                                  records={b.chainOfCustody.map(
                                    (r): ChainOfCustodyTimelineRecord => ({
                                      id: r.id,
                                      sequence: r.sequence,
                                      tier: r.tier as ChainOfCustodyTimelineRecord["tier"],
                                      participantName: r.participantName,
                                      participantCountry: r.participantCountry,
                                      externalBatchId: r.externalBatchId,
                                      certificationScheme: r.certificationScheme,
                                      massBalanceAllocationPercent: r.massBalanceAllocationPercent,
                                      // Server-side already filters this
                                      // buyer's view to VERIFIED-only tier
                                      // records — see
                                      // lib/services/get-client-portfolio.ts.
                                      status: "VERIFIED",
                                    })
                                  )}
                                  mode="readonly"
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-600 text-center">
              Generated {new Date(portfolio.generatedAt).toLocaleString()} · Same data available
              programmatically at GET /api/v1/client/passports with your API key.
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Top-level: owns the sessionStorage-backed auth state — identical shape
 * to app/auditor/page.tsx's AuditorPage.
 * ------------------------------------------------------------------------*/
export default function ClientPortalPage() {
  const [clientKey, setClientKey] = useState<string | null>(null);
  const [identity, setIdentity] = useState<ClientIdentity | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.sessionStorage.getItem(SESSION_KEY_STORAGE) : null;
    if (!stored) {
      setRestoring(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/v1/client/me", { headers: { [CLIENT_KEY_HEADER]: stored } });
        const body = await res.json().catch(() => null);
        if (res.ok && body?.success) {
          setClientKey(stored);
          setIdentity(body.data as ClientIdentity);
        } else {
          window.sessionStorage.removeItem(SESSION_KEY_STORAGE);
        }
      } catch {
        // Network hiccup on restore — fall back to the gate screen.
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  const handleAuthenticated = (key: string, id: ClientIdentity) => {
    window.sessionStorage.setItem(SESSION_KEY_STORAGE, key);
    setClientKey(key);
    setIdentity(id);
  };

  const handleSignOut = () => {
    window.sessionStorage.removeItem(SESSION_KEY_STORAGE);
    setClientKey(null);
    setIdentity(null);
  };

  if (restoring) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
      </div>
    );
  }

  if (!clientKey || !identity) {
    return <ClientGate onAuthenticated={handleAuthenticated} />;
  }

  return <ClientPortal clientKey={clientKey} identity={identity} onSignOut={handleSignOut} />;
}
