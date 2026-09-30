"use client";

/**
 * components/dashboard/chain-of-custody-timeline.tsx
 * -----------------------------------------------------------------------
 * Reusable, page-shape-agnostic vertical timeline for a passport's
 * Multi-Tier Chain of Custody (Multi-tier Supply Chain Verification &
 * Auditor Portal Expansion). Renders the dark-slate design language shared
 * by every DASHBOARD surface this sprint touches:
 *   - components/dashboard/batch-details-modal.tsx  (mode="readonly")
 *   - app/auditor/page.tsx                           (mode="review")
 *   - app/client-portal/page.tsx                     (mode="readonly")
 *
 * Deliberately NOT reused on the public QR scan page
 * (components/PublicScanPage.tsx) — that page is light-themed and already
 * renders every other relation (genealogy, certifications) with its own
 * inline markup rather than sharing components with the dark dashboard, so
 * this follows the same established precedent instead of forcing a
 * two-theme component.
 *
 * Two modes:
 *   - "readonly": status badges only, no actions. Used wherever a viewer
 *     should be able to SEE the chain of custody but never act on it — the
 *     admin batch modal (auditors act from their own portal, not here) and
 *     the Client Portal (read-only by design, see this sprint's notes on
 *     why suppliers/clients never get a flag/verify surface).
 *   - "review": adds a Verify / Flag / Reject action row (with a required
 *     notes field for Flag/Reject) to every PENDING_REVIEW record, wired
 *     through the `onReview` callback. Only ever used by the authenticated
 *     Auditor Portal.
 *
 * The caller controls which records are visible. In particular, a
 * VERIFIED-only array must be pre-filtered by the caller before reaching
 * this component whenever it renders in a context a non-privileged viewer
 * can see — this component itself renders whatever it is given, exactly
 * like the certifications list elsewhere in this app.
 */

import { useState } from "react";
import {
  Sprout, Recycle, Factory, Settings2, Truck, CircleDot,
  Clock, CheckCircle2, AlertTriangle, XCircle, ShieldQuestion,
  Loader2, FileText,
} from "lucide-react";

import { useLanguage } from "@/lib/hooks/use-language";
export type ChainOfCustodyTierValue =
  | "RAW_MATERIAL_SUPPLIER"
  | "RECYCLER"
  | "COMPOUNDER"
  | "PROCESSOR"
  | "DISTRIBUTOR"
  | "OTHER";

export type ChainOfCustodyStatusValue = "PENDING_REVIEW" | "VERIFIED" | "FLAGGED" | "REJECTED";

export interface ChainOfCustodyTimelineRecord {
  id: string;
  sequence: number;
  tier: ChainOfCustodyTierValue;
  participantName: string;
  participantCountry?: string | null;
  externalBatchId: string;
  certificationScheme?: string | null;
  certificateId?: string | null;
  massBalanceAllocationPercent?: string | number | null;
  notes?: string | null;
  status: ChainOfCustodyStatusValue;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
}

const TIER_META: Record<ChainOfCustodyTierValue, { label: string; icon: typeof Sprout }> = {
  RAW_MATERIAL_SUPPLIER: { label: "ui.common.rawMaterialSupplier", icon: Sprout },
  RECYCLER: { label: "ui.common.recycler", icon: Recycle },
  COMPOUNDER: { label: "ui.common.compounder", icon: Factory },
  PROCESSOR: { label: "ui.common.processor", icon: Settings2 },
  DISTRIBUTOR: { label: "ui.common.distributor", icon: Truck },
  OTHER: { label: "ui.coc.otherParticipant", icon: CircleDot },
};

const STATUS_META: Record<
  ChainOfCustodyStatusValue,
  { label: string; icon: typeof Clock; badgeCls: string; dotCls: string }
> = {
  PENDING_REVIEW: {
    label: "ui.common.pendingReview",
    icon: Clock,
    badgeCls: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    dotCls: "bg-amber-400",
  },
  VERIFIED: {
    label: "ui.common.verified",
    icon: CheckCircle2,
    badgeCls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    dotCls: "bg-emerald-400",
  },
  FLAGGED: {
    label: "ui.coc.flagged",
    icon: AlertTriangle,
    badgeCls: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    dotCls: "bg-orange-400",
  },
  REJECTED: {
    label: "ui.common.rejected",
    icon: XCircle,
    badgeCls: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    dotCls: "bg-rose-400",
  },
};

function StatusBadge({ status }: { status: ChainOfCustodyStatusValue }) {
  const { t } = useLanguage();
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium font-mono ${meta.badgeCls}`}
    >
      <Icon className="w-3 h-3" /> {t(meta.label)}
    </span>
  );
}

interface ReviewRowProps {
  record: ChainOfCustodyTimelineRecord;
  onReview: (
    recordId: string,
    status: "VERIFIED" | "FLAGGED" | "REJECTED",
    reviewNotes?: string
  ) => Promise<unknown>;
}

function ReviewRow({ record, onReview }: ReviewRowProps) {
  const { t } = useLanguage();
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<"VERIFIED" | "FLAGGED" | "REJECTED" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (status: "VERIFIED" | "FLAGGED" | "REJECTED") => {
    if ((status === "FLAGGED" || status === "REJECTED") && !notes.trim()) {
      setError("Notes are required to flag or reject a record.");
      return;
    }
    setError(null);
    setPending(status);
    try {
      await onReview(record.id, status, notes.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review action failed");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-slate-800 space-y-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t("ui.coc.reviewNotesRequiredForFlagReject")}
        rows={2}
        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
      />
      {error && (
        <div className="flex items-center gap-1.5 text-rose-400 text-[10px]">
          <AlertTriangle className="w-3 h-3 shrink-0" /> {error}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => act("VERIFIED")}
          disabled={pending !== null}
          className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-xs font-bold transition"
        >
          {pending === "VERIFIED" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          {t("ui.coc.verify")}
        </button>
        <button
          onClick={() => act("FLAGGED")}
          disabled={pending !== null}
          className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2 rounded-lg bg-orange-500/90 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-xs font-bold transition"
        >
          {pending === "FLAGGED" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {t("ui.coc.flag")}
        </button>
        <button
          onClick={() => act("REJECTED")}
          disabled={pending !== null}
          className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition"
        >
          {pending === "REJECTED" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
          {t("ui.common.reject")}
        </button>
      </div>
    </div>
  );
}

export interface ChainOfCustodyTimelineProps {
  records: ChainOfCustodyTimelineRecord[];
  mode?: "readonly" | "review";
  onReview?: (
    recordId: string,
    status: "VERIFIED" | "FLAGGED" | "REJECTED",
    reviewNotes?: string
  ) => Promise<unknown>;
  emptyLabel?: string;
}

export function ChainOfCustodyTimeline({
  records,
  mode = "readonly",
  onReview,
  emptyLabel = "No chain-of-custody records yet.",
}: ChainOfCustodyTimelineProps) {
  const { t } = useLanguage();
  if (records.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono py-2">
        <ShieldQuestion className="w-3.5 h-3.5 shrink-0" /> {emptyLabel}
      </div>
    );
  }

  const sorted = [...records].sort((a, b) => a.sequence - b.sequence);

  return (
    <ol className="relative space-y-3">
      {sorted.map((record, idx) => {
        const tierMeta = TIER_META[record.tier] ?? TIER_META.OTHER;
        const TierIcon = tierMeta.icon;
        const statusMeta = STATUS_META[record.status];
        const isLast = idx === sorted.length - 1;

        return (
          <li key={record.id} className="relative pl-9">
            {/* connector line */}
            {!isLast && (
              <span className="absolute left-[13px] top-8 bottom-[-12px] w-px bg-slate-800" aria-hidden="true" />
            )}
            {/* tier node */}
            <span
              className={`absolute left-0 top-0.5 w-7 h-7 rounded-full flex items-center justify-center border-2 border-slate-900 ring-1 ring-slate-800 ${statusMeta.dotCls}/20`}
            >
              <TierIcon className="w-3.5 h-3.5 text-slate-100" />
            </span>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                    <span>{t("suppliers.table.tier")} {record.sequence}</span>
                    <span>·</span>
                    <span>{t(tierMeta.label)}</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-100 truncate">{record.participantName}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {record.participantCountry ? `${record.participantCountry} · ` : ""}
                    {t("greenAccounting.table.batch")} {record.externalBatchId}
                  </div>
                </div>
                <span className="shrink-0">
                  <StatusBadge status={record.status} />
                </span>
              </div>

              {(record.certificationScheme || record.certificateId || record.massBalanceAllocationPercent != null) && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono flex-wrap">
                  <FileText className="w-3 h-3 shrink-0" />
                  {record.certificationScheme ? <span>{record.certificationScheme}</span> : null}
                  {record.certificateId ? <span>· {record.certificateId}</span> : null}
                  {record.massBalanceAllocationPercent != null ? (
                    <span>· {record.massBalanceAllocationPercent}{t("ui.coc.massBalance")}</span>
                  ) : null}
                </div>
              )}

              {record.notes && <p className="mt-2 text-[11px] text-slate-500">{record.notes}</p>}

              {record.status !== "PENDING_REVIEW" && (record.reviewedBy || record.reviewNotes) && (
                <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-500 font-mono">
                  {record.reviewedBy && <div>{t("ui.coc.reviewedBy")} {record.reviewedBy}</div>}
                  {record.reviewNotes && <div className="text-slate-400 mt-0.5">{record.reviewNotes}</div>}
                </div>
              )}

              {mode === "review" && record.status === "PENDING_REVIEW" && onReview && (
                <ReviewRow record={record} onReview={onReview} />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
