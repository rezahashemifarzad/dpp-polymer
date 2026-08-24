"use client";

/**
 * app/auditor/page.tsx
 * -----------------------------------------------------------------------
 * Auditor Portal — the Third-Party Auditor Verification Workflow's
 * frontend. An authenticated, individually-identified Auditor reviews the
 * PENDING_VERIFICATION queue and formally signs off (or rejects) each
 * batch.
 *
 * Auth model (deliberate, see lib/auditor-auth.ts and prisma/schema.prisma's
 * Auditor model): there is no login page, no session cookie, no server-side
 * session store. Each Auditor holds a personal API key (a bearer token,
 * provisioned via scripts/create-auditor.ts) that they paste into the gate
 * screen below once per browser tab. It is held ONLY in sessionStorage
 * (never localStorage, never a cookie) — cleared automatically when the
 * tab closes, and never sent anywhere except as the `x-dpp-auditor-key`
 * header on requests this page itself makes to /api/auditor/* and
 * /api/passports/{batchId}/verify.
 *
 * This is explicitly NOT an enterprise-grade session mechanism: no
 * httpOnly flag (XSS on this page could read the key), no CSRF protection
 * (not needed — the key itself is the credential, not an ambient cookie),
 * no expiry (a leaked key is valid until the Auditor row is deactivated
 * via `active: false`, see scripts/create-auditor.ts's rotation note).
 * That trade-off is intentional for this MVP's scale (a small number of
 * trusted external auditors), not an oversight.
 *
 * A deliberate architectural deviation from this app's other in-app UI
 * (which calls Server Actions to keep `process.env` secrets out of the
 * browser bundle): the auditor's personal key is not a server secret at
 * all — it is a credential the human auditor types in themselves — so
 * there is nothing to hide from the browser here, and calling the REST
 * routes directly with fetch() is simpler and more transparent than
 * routing through a Server Action that would just forward the same header.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck, KeyRound, Loader2, LogOut, RefreshCw, Inbox, ClipboardList,
  CheckCircle2, XCircle, AlertTriangle, Factory, Gauge, Recycle, Leaf,
  BadgeCheck, Download, CalendarDays, ArrowLeft, Layers, Link2,
} from "lucide-react";
import Link from "next/link";
import { ChainOfCustodyTimeline, type ChainOfCustodyTierValue } from "@/components/dashboard/chain-of-custody-timeline";

const SESSION_KEY_STORAGE = "dpp-auditor-key";
const AUDITOR_KEY_HEADER = "x-dpp-auditor-key";

/* ---------------------------------------------------------------------------
 * Types — mirror the JSON shape GET /api/auditor/queue returns (Decimal
 * fields arrive as strings, per this app's established convention — see
 * lib/hooks/use-passports.ts's file banner for why: Prisma.Decimal.toJSON()
 * serializes to its exact decimal string, never a lossy float).
 * ------------------------------------------------------------------------*/
interface AuditorIdentity {
  id: string;
  name: string;
  organization: string;
}

interface QueueCertification {
  id: string;
  scheme: string;
  certificateId: string;
  issuingBody: string;
  validFrom: string;
  validUntil: string;
  documentUrl: string | null;
  documentHash: string | null;
  verificationStatus: "PENDING_REVIEW" | "VERIFIED" | "REJECTED";
}

interface QueueCarbonFootprintCalculation {
  weightKg: string;
  totalKgCO2e: string;
  transportMode: string;
  emissionFactorVersion: string;
}

interface QueuePassport {
  id: string;
  batchId: string;
  gtin: string;
  polymerType: string;
  grade: string;
  meltFlowIndex: string;
  mfiTestStandard: string;
  density: string;
  densityTestStandard: string;
  recycledContentSource: string | null;
  recycledContentPercent: string;
  bioBasedPercent: string;
  carbonFootprintKgCO2ePerKg: string;
  lcaMethodology: string;
  lcaScope: string;
  lcaThirdPartyVerified: boolean;
  lcaVerifierName: string | null;
  productionDate: string;
  status: string;
  manufacturer: { legalName: string; country: string };
  certifications: QueueCertification[];
  carbonFootprintCalculation: QueueCarbonFootprintCalculation | null;
}

type ActionState = { batchId: string; kind: "verify" | "reject" } | null;
type Banner = { tone: "success" | "error"; message: string } | null;

// Multi-tier Supply Chain Verification & Auditor Portal Expansion — mirrors
// GET /api/auditor/coc-queue's response shape. A distinct, narrower queue
// item than QueuePassport above: this is one TIER RECORD awaiting its own
// review, not a whole passport awaiting PENDING_VERIFICATION sign-off (see
// that route's own file banner for why these are two separate queues).
interface CocQueueRecord {
  id: string;
  sequence: number;
  tier: ChainOfCustodyTierValue;
  participantName: string;
  participantCountry: string | null;
  externalBatchId: string;
  certificationScheme: string | null;
  certificateId: string | null;
  massBalanceAllocationPercent: string | null;
  notes: string | null;
  createdAt: string;
  passport: {
    id: string;
    batchId: string;
    polymerType: string;
    grade: string;
    gtin: string;
    manufacturer: { id: string; legalName: string } | null;
  };
}

/* ---------------------------------------------------------------------------
 * Key-entry gate
 * ------------------------------------------------------------------------*/
function AuditorGate({ onAuthenticated }: { onAuthenticated: (key: string, identity: AuditorIdentity) => void }) {
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
      const res = await fetch("/api/auditor/me", { headers: { [AUDITOR_KEY_HEADER]: trimmed } });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setError(body?.error ?? "That key was not recognized. Check it and try again.");
        return;
      }
      onAuthenticated(trimmed, body.data as AuditorIdentity);
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
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide">Auditor Portal</h1>
            <p className="text-xs text-slate-400">Third-Party Verification Sign-in</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-4 mb-4 font-mono leading-relaxed">
          Enter your personal auditor API key. It is held only in this browser tab's session
          storage — never saved, never sent anywhere but this portal — and clears automatically
          when the tab closes.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            autoFocus
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Personal auditor key"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
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
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold py-2.5 rounded-lg text-sm transition-all"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Sign In
          </button>
        </form>
        <div className="mt-5 pt-4 border-t border-slate-800 text-center">
          <Link href="/admin" className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300">
            <ArrowLeft className="w-3 h-3" /> Back to Admin Console
          </Link>
        </div>
      </div>
    </div>
  );
}

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

/* ---------------------------------------------------------------------------
 * Review detail panel
 * ------------------------------------------------------------------------*/
function ReviewPanel({
  passport,
  auditorKey,
  actionState,
  onSubmitted,
  onError,
}: {
  passport: QueuePassport;
  auditorKey: string;
  actionState: ActionState;
  onSubmitted: (batchId: string, message: string) => void;
  onError: (message: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<"verify" | "reject" | null>(null);

  // Reset the notes field whenever the reviewer switches to a different
  // batch, so notes typed for one review can't accidentally be submitted
  // against another.
  useEffect(() => {
    setNotes("");
  }, [passport.id]);

  const submit = async (decision: "AUDITOR_VERIFIED" | "REJECTED_BY_AUDITOR") => {
    if (decision === "REJECTED_BY_AUDITOR" && !notes.trim()) {
      onError("Rejection requires a note explaining the compliance concern.");
      return;
    }
    setPending(decision === "AUDITOR_VERIFIED" ? "verify" : "reject");
    try {
      const res = await fetch(`/api/passports/${encodeURIComponent(passport.batchId)}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [AUDITOR_KEY_HEADER]: auditorKey },
        body: JSON.stringify({ decision, notes: notes.trim() || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        onError(body?.error ?? "Failed to submit your review. Please try again.");
        return;
      }
      onSubmitted(
        passport.batchId,
        decision === "AUDITOR_VERIFIED"
          ? `${passport.batchId} verified and digitally signed.`
          : `${passport.batchId} rejected — manufacturer will need to resubmit.`
      );
    } catch {
      onError("Could not reach the server. Please try again.");
    } finally {
      setPending(null);
    }
  };

  const isBusy = pending !== null || (actionState !== null && actionState.batchId === passport.batchId);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{passport.polymerType} · {passport.grade}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-500">
            <span>{passport.batchId}</span>
            <span>·</span>
            <span>GTIN {passport.gtin}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
            <Factory className="w-3.5 h-3.5" /> {passport.manufacturer.legalName} · {passport.manufacturer.country}
          </div>
        </div>
        <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">
          {passport.status}
        </span>
      </div>

      {/* Technical properties */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg bg-slate-950 border border-slate-800 p-3">
          <div className="text-[10px] text-slate-500 flex items-center gap-1"><Gauge className="w-3 h-3" /> Melt Flow Index</div>
          <div className="font-mono text-sm text-slate-100 mt-1">{passport.meltFlowIndex} g/10min</div>
          <div className="text-[10px] text-slate-600 mt-0.5">{passport.mfiTestStandard}</div>
        </div>
        <div className="rounded-lg bg-slate-950 border border-slate-800 p-3">
          <div className="text-[10px] text-slate-500">Density</div>
          <div className="font-mono text-sm text-slate-100 mt-1">{passport.density} g/cm³</div>
          <div className="text-[10px] text-slate-600 mt-0.5">{passport.densityTestStandard}</div>
        </div>
        <div className="rounded-lg bg-slate-950 border border-slate-800 p-3">
          <div className="text-[10px] text-slate-500 flex items-center gap-1"><Recycle className="w-3 h-3" /> Recycled Content</div>
          <div className="font-mono text-sm text-emerald-400 mt-1">{passport.recycledContentPercent}%</div>
          <div className="text-[10px] text-slate-600 mt-0.5">{passport.recycledContentSource ?? "—"}</div>
        </div>
        <div className="rounded-lg bg-slate-950 border border-slate-800 p-3">
          <div className="text-[10px] text-slate-500 flex items-center gap-1"><Leaf className="w-3 h-3" /> Carbon Footprint</div>
          <div className="font-mono text-sm text-slate-100 mt-1">{passport.carbonFootprintKgCO2ePerKg} kgCO₂e/kg</div>
          <div className="text-[10px] text-slate-600 mt-0.5">
            {passport.lcaMethodology}{passport.lcaThirdPartyVerified ? ` · verified by ${passport.lcaVerifierName ?? "third party"}` : " · self-reported"}
          </div>
        </div>
      </div>

      {passport.carbonFootprintCalculation && (
        <div className="text-xs text-slate-500 font-mono">
          Illustrative Scope 1/2/3 estimate: {passport.carbonFootprintCalculation.totalKgCO2e} kg total
          ({passport.carbonFootprintCalculation.emissionFactorVersion})
        </div>
      )}

      {/* Certifications */}
      <div>
        <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
          <BadgeCheck className="w-3.5 h-3.5 text-amber-400" /> Certifications ({passport.certifications.length})
        </h3>
        {passport.certifications.length === 0 ? (
          <p className="text-xs text-slate-600">No certifications attached to this batch.</p>
        ) : (
          <div className="space-y-2">
            {passport.certifications.map((c) => (
              <div key={c.id} className="rounded-lg bg-slate-950 border border-slate-800 p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-slate-100 font-medium">{CERT_LABELS[c.scheme] ?? c.scheme}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{c.issuingBody} · {c.certificateId}</div>
                  <div className="text-[10px] text-slate-600 flex items-center gap-1 mt-1">
                    <CalendarDays className="w-3 h-3" /> Valid {new Date(c.validFrom).toLocaleDateString()} – {new Date(c.validUntil).toLocaleDateString()}
                  </div>
                  {c.documentHash && (
                    <div className="text-[10px] font-mono text-slate-600 break-all mt-1">SHA-256 {c.documentHash}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                      c.verificationStatus === "VERIFIED"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : c.verificationStatus === "REJECTED"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    {c.verificationStatus.replace("_", " ")}
                  </span>
                  {c.documentUrl && (
                    <a
                      href={c.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                    >
                      <Download className="w-3 h-3" /> Document
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review notes + actions */}
      <div className="pt-4 border-t border-slate-800 space-y-3">
        <label className="block text-xs font-semibold text-slate-300">
          Audit Notes / Compliance Remarks
          <span className="text-slate-600 font-normal"> (required to reject, optional to verify)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Findings, concerns, or context for this decision..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
        />
        <p className="text-[10px] text-slate-600">
          Notes are visible to your organization and platform admins only — never shown on the public passport page.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => submit("AUDITOR_VERIFIED")}
            disabled={isBusy}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold py-2.5 rounded-lg text-sm transition-all"
          >
            {pending === "verify" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Approve &amp; Sign Digitally
          </button>
          <button
            onClick={() => submit("REJECTED_BY_AUDITOR")}
            disabled={isBusy}
            className="flex-1 flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-rose-400 font-semibold py-2.5 rounded-lg text-sm transition-all"
          >
            {pending === "reject" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Reject with Notes
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Main portal (post-authentication)
 * ------------------------------------------------------------------------*/
function AuditorPortal({
  auditorKey,
  identity,
  onSignOut,
}: {
  auditorKey: string;
  identity: AuditorIdentity;
  onSignOut: () => void;
}) {
  const [queue, setQueue] = useState<QueuePassport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [actionState, setActionState] = useState<ActionState>(null);

  // Multi-tier Supply Chain Verification & Auditor Portal Expansion — a
  // second, independent tab/queue alongside the existing whole-passport
  // review above. A tier record can be reviewed at any point in its
  // passport's own lifecycle, so this is deliberately its own list, not a
  // filter on the passport queue.
  const [activeTab, setActiveTab] = useState<"passports" | "chain-of-custody">("passports");
  const [cocQueue, setCocQueue] = useState<CocQueueRecord[]>([]);
  const [cocLoading, setCocLoading] = useState(true);
  const [selectedCocRecordId, setSelectedCocRecordId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auditor/queue", { headers: { [AUDITOR_KEY_HEADER]: auditorKey } });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setBanner({ tone: "error", message: body?.error ?? "Failed to load the review queue." });
        return;
      }
      setQueue(body.data as QueuePassport[]);
    } catch {
      setBanner({ tone: "error", message: "Could not reach the server while loading the queue." });
    } finally {
      setLoading(false);
    }
  }, [auditorKey]);

  const fetchCocQueue = useCallback(async () => {
    setCocLoading(true);
    try {
      const res = await fetch("/api/auditor/coc-queue", { headers: { [AUDITOR_KEY_HEADER]: auditorKey } });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setBanner({ tone: "error", message: body?.error ?? "Failed to load the chain-of-custody review queue." });
        return;
      }
      setCocQueue(body.data as CocQueueRecord[]);
    } catch {
      setBanner({ tone: "error", message: "Could not reach the server while loading the chain-of-custody queue." });
    } finally {
      setCocLoading(false);
    }
  }, [auditorKey]);

  useEffect(() => {
    fetchQueue();
    fetchCocQueue();
  }, [fetchQueue, fetchCocQueue]);

  const handleSubmitted = (batchId: string, message: string) => {
    setBanner({ tone: "success", message });
    setActionState({ batchId, kind: "verify" });
    setSelectedBatchId(null);
    fetchQueue();
  };

  const handleCocReview = async (
    recordId: string,
    status: "VERIFIED" | "FLAGGED" | "REJECTED",
    reviewNotes?: string
  ) => {
    const record = cocQueue.find((r) => r.id === recordId);
    if (!record) throw new Error("This record is no longer in the queue — try refreshing.");

    const res = await fetch(
      `/api/passports/${encodeURIComponent(record.passport.batchId)}/chain-of-custody/${recordId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [AUDITOR_KEY_HEADER]: auditorKey },
        body: JSON.stringify({ status, reviewNotes }),
      }
    );
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) {
      throw new Error(body?.error ?? "Failed to submit your review. Please try again.");
    }

    setBanner({
      tone: "success",
      message: `${record.participantName} (${record.passport.batchId}) marked ${status.toLowerCase()}.`,
    });
    setSelectedCocRecordId(null);
    fetchCocQueue();
  };

  const selected = queue.find((p) => p.batchId === selectedBatchId) ?? null;
  const selectedCocRecord = cocQueue.find((r) => r.id === selectedCocRecordId) ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans overflow-x-hidden">
      {/* Header — stacks below md so the identity line (which can run long:
          "Signed in as {name} · {organization}") and the two action links
          never fight each other for width on a phone; the action-link row
          wraps too, as a safety net. */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 mb-6 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-wide">Auditor Portal</h1>
            <p className="text-xs text-slate-400">
              Signed in as <span className="text-amber-400 font-medium">{identity.name}</span> · {identity.organization}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Admin Console
          </Link>
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-4">
        {banner && (
          <div
            className={`flex items-start justify-between gap-3 rounded-lg px-4 py-2.5 text-xs border ${
              banner.tone === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            }`}
          >
            <span className="flex items-center gap-2">
              {banner.tone === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {banner.message}
            </span>
            <button onClick={() => setBanner(null)} className="text-current opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Tab switch — the two review workflows are independent (see the
            CocQueueRecord comment above): a tier record's own review has
            nothing to do with whether its parent passport is itself still
            PENDING_VERIFICATION. */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-px">
          <button
            onClick={() => setActiveTab("passports")}
            className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 border-b-2 transition-all ${
              activeTab === "passports"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" /> Passport Review ({queue.length})
          </button>
          <button
            onClick={() => setActiveTab("chain-of-custody")}
            className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 border-b-2 transition-all ${
              activeTab === "chain-of-custody"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <Link2 className="w-3.5 h-3.5" /> Chain of Custody Review ({cocQueue.length})
          </button>
        </div>

        {activeTab === "passports" ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Queue list */}
            <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-amber-400" />
                  Review Queue ({queue.length})
                </h2>
                <button
                  onClick={() => fetchQueue()}
                  className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {loading && queue.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-slate-500 text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading queue...
                </div>
              ) : queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-2">
                  <Inbox className="w-8 h-8" />
                  <p className="text-xs">No batches awaiting review.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {queue.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedBatchId(p.batchId)}
                      className={`w-full text-left rounded-lg border p-3 transition-all ${
                        selectedBatchId === p.batchId
                          ? "bg-amber-500/10 border-amber-500/40"
                          : "bg-slate-950 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-slate-200">{p.batchId}</span>
                        <span className="text-[10px] text-slate-500">{new Date(p.productionDate).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{p.polymerType} · {p.grade}</div>
                      <div className="text-[10px] text-slate-600 mt-0.5">{p.manufacturer.legalName}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Review panel */}
            <div className="lg:col-span-3">
              {selected ? (
                <ReviewPanel
                  passport={selected}
                  auditorKey={auditorKey}
                  actionState={actionState}
                  onSubmitted={handleSubmitted}
                  onError={(message) => setBanner({ tone: "error", message })}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-slate-900/60 border border-slate-800 border-dashed rounded-xl p-10 text-slate-600 gap-2">
                  <Layers className="w-8 h-8" />
                  <p className="text-xs text-center">Select a batch from the queue to begin your review.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Chain-of-custody queue list */}
            <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-amber-400" />
                  Tier Records ({cocQueue.length})
                </h2>
                <button
                  onClick={() => fetchCocQueue()}
                  className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cocLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {cocLoading && cocQueue.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-slate-500 text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading queue...
                </div>
              ) : cocQueue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-2">
                  <Inbox className="w-8 h-8" />
                  <p className="text-xs">No chain-of-custody tiers awaiting review.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cocQueue.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedCocRecordId(r.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-all ${
                        selectedCocRecordId === r.id
                          ? "bg-amber-500/10 border-amber-500/40"
                          : "bg-slate-950 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-slate-200">{r.passport.batchId}</span>
                        <span className="text-[10px] text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{r.participantName}</div>
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        {r.passport.polymerType} · {r.passport.grade}
                        {r.passport.manufacturer ? ` · ${r.passport.manufacturer.legalName}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Review panel */}
            <div className="lg:col-span-3">
              {selectedCocRecord ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100">
                      {selectedCocRecord.passport.polymerType} · {selectedCocRecord.passport.grade}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-500">
                      <span>{selectedCocRecord.passport.batchId}</span>
                      <span>·</span>
                      <span>GTIN {selectedCocRecord.passport.gtin}</span>
                    </div>
                    {selectedCocRecord.passport.manufacturer && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
                        <Factory className="w-3.5 h-3.5" /> {selectedCocRecord.passport.manufacturer.legalName}
                      </div>
                    )}
                  </div>
                  <ChainOfCustodyTimeline
                    records={[
                      {
                        id: selectedCocRecord.id,
                        sequence: selectedCocRecord.sequence,
                        tier: selectedCocRecord.tier,
                        participantName: selectedCocRecord.participantName,
                        participantCountry: selectedCocRecord.participantCountry,
                        externalBatchId: selectedCocRecord.externalBatchId,
                        certificationScheme: selectedCocRecord.certificationScheme,
                        certificateId: selectedCocRecord.certificateId,
                        massBalanceAllocationPercent: selectedCocRecord.massBalanceAllocationPercent,
                        notes: selectedCocRecord.notes,
                        status: "PENDING_REVIEW",
                      },
                    ]}
                    mode="review"
                    onReview={handleCocReview}
                  />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-slate-900/60 border border-slate-800 border-dashed rounded-xl p-10 text-slate-600 gap-2">
                  <Layers className="w-8 h-8" />
                  <p className="text-xs text-center">Select a tier record from the queue to begin your review.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Top-level: owns the sessionStorage-backed auth state
 * ------------------------------------------------------------------------*/
export default function AuditorPage() {
  const [auditorKey, setAuditorKey] = useState<string | null>(null);
  const [identity, setIdentity] = useState<AuditorIdentity | null>(null);
  const [restoring, setRestoring] = useState(true);

  // On mount, try to resume a session already held in this tab's
  // sessionStorage (e.g. a page refresh) — re-validated against
  // /api/auditor/me rather than trusted blindly, since the key may have
  // been deactivated server-side since it was stored.
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.sessionStorage.getItem(SESSION_KEY_STORAGE) : null;
    if (!stored) {
      setRestoring(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/auditor/me", { headers: { [AUDITOR_KEY_HEADER]: stored } });
        const body = await res.json().catch(() => null);
        if (res.ok && body?.success) {
          setAuditorKey(stored);
          setIdentity(body.data as AuditorIdentity);
        } else {
          window.sessionStorage.removeItem(SESSION_KEY_STORAGE);
        }
      } catch {
        // Network hiccup on restore — fall back to the gate screen rather
        // than blocking; the user can just sign in again.
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  const handleAuthenticated = (key: string, id: AuditorIdentity) => {
    window.sessionStorage.setItem(SESSION_KEY_STORAGE, key);
    setAuditorKey(key);
    setIdentity(id);
  };

  const handleSignOut = () => {
    window.sessionStorage.removeItem(SESSION_KEY_STORAGE);
    setAuditorKey(null);
    setIdentity(null);
  };

  if (restoring) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
      </div>
    );
  }

  if (!auditorKey || !identity) {
    return <AuditorGate onAuthenticated={handleAuthenticated} />;
  }

  return <AuditorPortal auditorKey={auditorKey} identity={identity} onSignOut={handleSignOut} />;
}
