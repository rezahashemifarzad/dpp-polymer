"use client";

/**
 * components/dashboard/supplier-review-panel.tsx
 * -----------------------------------------------------------------------
 * Phase 4 - Step 2: Supplier Onboarding Portal — the admin console's
 * review-queue widget (app/admin/page.tsx), mirroring
 * components/dashboard/expiry-alert-banner.tsx's overall shape (fetch on
 * mount, expandable detail table, per-row actions with a toast on
 * success/failure) but reading through Server Actions instead of a public
 * fetch() — see lib/actions/list-supplier-submissions.ts's own file
 * banner for why: this data carries a supplier company's contact PII and
 * unreviewed proposed batch figures, unlike the expiry-alert widget's
 * already-public certification data.
 *
 * Three pieces in one file (co-located rather than split, matching this
 * app's own "small duplication over premature abstraction" convention
 * used elsewhere — see lib/client-auth.ts's comment on the same
 * trade-off): the review queue table, an "Invite Supplier" modal, and a
 * collapsible "Manage Invites" list. All three revolve around the same
 * SupplierInvite/SupplierSubmission data and don't benefit from being
 * three separately-fetching components.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  UserPlus,
  Copy,
  Check,
  KeyRound,
  Ban,
  AlertTriangle,
  Inbox,
  X,
} from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { listSupplierSubmissionsAction } from "@/lib/actions/list-supplier-submissions";
import { approveSupplierSubmissionAction } from "@/lib/actions/approve-supplier-submission";
import { rejectSupplierSubmissionAction } from "@/lib/actions/reject-supplier-submission";
import { createSupplierInviteAction } from "@/lib/actions/create-supplier-invite";
import { listSupplierInvitesAction, revokeSupplierInviteAction } from "@/lib/actions/list-supplier-invites";

import { useLanguage } from "@/lib/hooks/use-language";
const inputCls =
  "w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500";

interface SupplierSubmissionRow {
  id: string;
  invite: { id: string; companyName: string; contactName: string; contactEmail: string; country: string };
  polymerType: string;
  grade: string;
  meltFlowIndex: string | null;
  density: string | null;
  proposedGtin: string | null;
  proposedBatchId: string | null;
  recycledContentPercent: string;
  bioBasedPercent: string;
  carbonFootprintKgCO2ePerKg: string;
  weightKg: string | null;
  certScheme: string | null;
  certificateId: string | null;
  issuingBody: string | null;
  certValidFrom: string | null;
  certValidUntil: string | null;
  certDocumentUrl: string | null;
  supplierNotes: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: string;
}

interface SupplierInviteRow {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  country: string;
  active: boolean;
  invitedAt: string;
  expiresAt: string | null;
  manufacturerId: string | null;
  _count: { submissions: number };
}

function hasCompleteCert(row: SupplierSubmissionRow) {
  return Boolean(row.certScheme && row.certificateId && row.issuingBody && row.certValidFrom && row.certValidUntil);
}

// ----------------------------------------------------------------------------
// Approve modal — pre-filled overrides for whatever the submission itself
// couldn't reliably supply (see approveSupplierSubmission's own rationale).
// ----------------------------------------------------------------------------
function ApproveModal({
  row,
  onClose,
  onApproved,
}: {
  row: SupplierSubmissionRow;
  onClose: () => void;
  onApproved: () => void;
}) {
  const { t } = useLanguage();
  const { push } = useToast();
  const [gtin, setGtin] = useState(row.proposedGtin ?? "");
  const [batchId, setBatchId] = useState(row.proposedBatchId ?? "");
  const [meltFlowIndex, setMeltFlowIndex] = useState(row.meltFlowIndex ?? "");
  const [density, setDensity] = useState(row.density ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const certMissing = !hasCompleteCert(row);

  const handleApprove = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await approveSupplierSubmissionAction(row.id, {
        gtin: gtin || undefined,
        batchId: batchId || undefined,
        meltFlowIndex: meltFlowIndex ? Number(meltFlowIndex) : undefined,
        density: density ? Number(density) : undefined,
      });
      if (!result.ok) {
        throw new Error(result.error || "Failed to approve submission");
      }
      push({
        variant: "success",
        title: t("ui.common.passportIssued"),
        description: t("ui.supReview.sSubmissionIsNowALive", { v0: row.invite.companyName }),
      });
      onApproved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve submission");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 relative shadow-2xl my-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800"
          aria-label={t("common.close")}
        >
          <X className="w-4 h-4" />
        </button>
        <h3 className="text-lg font-bold text-white mb-1">{t("ui.supReview.approveSubmission")}</h3>
        <p className="text-xs text-slate-400 mb-4 font-mono">
          {row.invite.companyName} — {row.grade} ({row.polymerType})
        </p>

        {certMissing && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-300 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {t("ui.supReview.thisSubmissionHasNoCompleteCertification")}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-3 font-mono text-xs">
          <p className="text-slate-500 text-[10px]">
            {t("ui.supReview.confirmOrOverrideTheValuesNeeded")}
          </p>
          <label className="block">
            <span className="text-slate-400 block mb-1">{t("ui.supReview.gtin14DigitsRequired")}</span>
            <input value={gtin} onChange={(e) => setGtin(e.target.value)} className={inputCls} placeholder="04012345678901" />
          </label>
          <label className="block">
            <span className="text-slate-400 block mb-1">{t("audit.table.batchId")}</span>
            <input value={batchId} onChange={(e) => setBatchId(e.target.value)} className={inputCls} placeholder={t("ui.supReview.autoGeneratedIfLeftBlank")} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-slate-400 block mb-1">{t("ui.supReview.meltFlowIndex")}</span>
              <input type="number" step="0.01" value={meltFlowIndex} onChange={(e) => setMeltFlowIndex(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="text-slate-400 block mb-1">{t("ui.supReview.density")}</span>
              <input type="number" step="0.001" value={density} onChange={(e) => setDensity(e.target.value)} className={inputCls} />
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleApprove}
            disabled={submitting || certMissing}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2 text-xs"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? t("ui.common.issuing") : t("ui.supReview.approveIssuePassport")}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 text-xs">
            {t("ui.common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Reject modal
// ----------------------------------------------------------------------------
function RejectModal({
  row,
  onClose,
  onRejected,
}: {
  row: SupplierSubmissionRow;
  onClose: () => void;
  onRejected: () => void;
}) {
  const { t } = useLanguage();
  const { push } = useToast();
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReject = async () => {
    if (!reviewNotes.trim()) {
      setError("Feedback is required so the supplier knows what to fix.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await rejectSupplierSubmissionAction(row.id, reviewNotes);
      if (!result.ok) {
        throw new Error(result.error || "Failed to reject submission");
      }
      push({ variant: "success", title: t("ui.supReview.submissionRejected"), description: t("ui.supReview.willNeedToResubmit", { v0: row.invite.companyName }) });
      onRejected();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject submission");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 relative shadow-2xl my-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800"
          aria-label={t("common.close")}
        >
          <X className="w-4 h-4" />
        </button>
        <h3 className="text-lg font-bold text-white mb-1">{t("ui.supReview.rejectSubmission")}</h3>
        <p className="text-xs text-slate-400 mb-4 font-mono">
          {row.invite.companyName} — {row.grade} ({row.polymerType})
        </p>

        {error && (
          <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-300">
            {error}
          </div>
        )}

        <label className="block font-mono text-xs">
          <span className="text-slate-400 block mb-1">{t("ui.supReview.feedbackForTheSupplierRequired")}</span>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={4}
            className={inputCls}
            placeholder={t("ui.supReview.eGMissingIsccPlusCertificate")}
          />
        </label>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleReject}
            disabled={submitting}
            className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 text-xs"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? t("ui.supReview.rejecting") : t("ui.supReview.rejectSubmission")}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 text-xs">
            {t("ui.common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Invite modal — creates a SupplierInvite and shows the raw token ONCE
// ----------------------------------------------------------------------------
function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useLanguage();
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [country, setCountry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ submitUrl: string; companyName: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await createSupplierInviteAction({
        companyName,
        contactName,
        contactEmail,
        contactPhone: contactPhone || undefined,
        country,
      });
      if (!result.ok || !result.data) {
        throw new Error(result.error || "Failed to create supplier invite");
      }
      setCreated({ submitUrl: result.data.submitUrl, companyName: result.data.companyName });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create supplier invite");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.submitUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (permissions, non-HTTPS context)
      // — the link is still selectable/visible in the box below, so this
      // is a soft failure, not a blocker.
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 relative shadow-2xl my-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800"
          aria-label={t("common.close")}
        >
          <X className="w-4 h-4" />
        </button>

        {created ? (
          <>
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              {t("ui.supReview.inviteCreated")}
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">
              {t("ui.supReview.sendThisLinkTo")} {created.companyName}{t("ui.supReview.itIsShownOnceItCannot")}
            </p>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-emerald-400 break-all mb-3">
              {created.submitUrl}
            </div>
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs mb-3"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? t("ui.common.copied") : t("ui.supReview.copyLink")}
            </button>
            <button onClick={onClose} className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs">
              {t("ui.common.done")}
            </button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold text-white mb-1">{t("ui.supReview.inviteSupplier")}</h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">
              {t("ui.supReview.generatesAOneTimeSubmissionLink")}
            </p>

            {error && (
              <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3 font-mono text-xs">
              <label className="block">
                <span className="text-slate-400 block mb-1">{t("ui.common.companyName")}</span>
                <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-slate-400 block mb-1">{t("ui.supReview.contactName")}</span>
                  <input required value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">{t("accounts.table.country")}</span>
                  <input required value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} />
                </label>
              </div>
              <label className="block">
                <span className="text-slate-400 block mb-1">{t("accounts.table.contactEmail")}</span>
                <input required type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-slate-400 block mb-1">{t("ui.supReview.contactPhoneOptional")}</span>
                <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputCls} />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? t("ui.common.creating") : t("ui.supReview.createInviteLink")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Invite management list — collapsible
// ----------------------------------------------------------------------------
function InviteManager({ refreshKey }: { refreshKey: number }) {
  const { t } = useLanguage();
  const { push } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [invites, setInvites] = useState<SupplierInviteRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listSupplierInvitesAction();
      if (result.ok && result.data) {
        setInvites(result.data as SupplierInviteRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded) load();
  }, [expanded, load, refreshKey]);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      const result = await revokeSupplierInviteAction(id);
      if (!result.ok) throw new Error(result.error || "Failed to revoke invite");
      push({ variant: "success", title: t("ui.supReview.inviteRevoked"), description: t("ui.supReview.thatSubmissionLinkNoLongerWorks") });
      await load();
    } catch (err) {
      push({ variant: "error", title: t("ui.supReview.couldnTRevokeInvite"), description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="mt-4 border-t border-slate-800 pt-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-all"
      >
        <KeyRound className="w-3 h-3" />
        {expanded ? t("ui.supReview.hide") : t("ui.common.manage")} {t("ui.supReview.supplierInvites")}
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-3 overflow-x-auto">
          {loading && !invites ? (
            <div className="text-slate-500 text-xs font-mono py-3">{t("ui.supReview.loadingInvites")}</div>
          ) : !invites || invites.length === 0 ? (
            <div className="text-slate-500 text-xs font-mono py-3">{t("ui.supReview.noSupplierInvitesYet")}</div>
          ) : (
            <table className="w-full text-left font-mono text-xs min-w-[560px]">
              <thead>
                <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                  <th className="py-2 pr-3">{t("accounts.table.company")}</th>
                  <th className="py-2 pr-3">{t("ui.supReview.contact")}</th>
                  <th className="py-2 pr-3">{t("ui.supReview.submissions")}</th>
                  <th className="py-2 pr-3">{t("common.status")}</th>
                  <th className="py-2 text-right">{t("audit.table.action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {invites.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 pr-3 text-slate-200 whitespace-nowrap">{inv.companyName}</td>
                    <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{inv.contactName}</td>
                    <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{inv._count.submissions}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {inv.active ? (
                        <span className="text-emerald-400">{t("greenAccounting.table.active")}</span>
                      ) : (
                        <span className="text-slate-600">{t("ui.supReview.revoked")}</span>
                      )}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {inv.active && (
                        <button
                          onClick={() => handleRevoke(inv.id)}
                          disabled={revokingId === inv.id}
                          className="inline-flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-rose-400 px-2 py-1 rounded-md transition-all"
                        >
                          {revokingId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                          {t("ui.supReview.revoke")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Main panel
// ----------------------------------------------------------------------------
export function SupplierReviewPanel() {
  const { t } = useLanguage();
  const [submissions, setSubmissions] = useState<SupplierSubmissionRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [approveTarget, setApproveTarget] = useState<SupplierSubmissionRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SupplierSubmissionRow | null>(null);
  const [inviteRefreshKey, setInviteRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSupplierSubmissionsAction("PENDING");
      if (!result.ok) throw new Error(result.error || "Failed to load supplier submissions");
      setSubmissions((result.data as SupplierSubmissionRow[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load supplier submissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingCount = submissions?.length ?? 0;

  const rows = useMemo(() => submissions ?? [], [submissions]);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Inbox className="w-5 h-5 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">{t("ui.supReview.supplierOnboardingReviewQueue")}</h3>
            <p className="text-[11px] text-slate-400 font-mono">
              {loading ? t("ui.common.loading") : t(pendingCount === 1 ? "ui.supReview.pendingSubmission" : "ui.supReview.pendingSubmissions", { v0: pendingCount })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-all"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 text-[11px] bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 px-2.5 py-1.5 rounded-lg transition-all"
          >
            <UserPlus className="w-3 h-3" />
            {t("ui.supReview.inviteSupplier")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-xs font-mono text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="mt-4 text-xs text-slate-500 font-mono">{t("ui.supReview.noPendingSupplierSubmissionsRightNow")}</p>
      )}

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs min-w-[720px]">
            <thead>
              <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                <th className="py-2 pr-3">{t("accounts.table.company")}</th>
                <th className="py-2 pr-3">{t("ui.supReview.grade")}</th>
                <th className="py-2 pr-3">{t("ui.supReview.polymer")}</th>
                <th className="py-2 pr-3">PCR %</th>
                <th className="py-2 pr-3">{t("ui.common.certificate")}</th>
                <th className="py-2 pr-3">{t("ui.supReview.submitted")}</th>
                <th className="py-2 text-right">{t("audit.table.action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 pr-3 text-slate-200 whitespace-nowrap">{row.invite.companyName}</td>
                  <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">{row.grade}</td>
                  <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{row.polymerType}</td>
                  <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{row.recycledContentPercent}%</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {hasCompleteCert(row) ? (
                      <span className="text-emerald-400">{row.certScheme}</span>
                    ) : (
                      <span className="text-amber-400 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {t("ui.supReview.missing")}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">
                    {new Date(row.submittedAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <div className="inline-flex gap-1.5">
                      <button
                        onClick={() => setApproveTarget(row)}
                        className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-2 py-1 rounded-md transition-all"
                      >
                        <CheckCircle2 className="w-3 h-3" /> {t("ui.supReview.approve")}
                      </button>
                      <button
                        onClick={() => setRejectTarget(row)}
                        className="inline-flex items-center gap-1 text-[10px] bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 px-2 py-1 rounded-md transition-all"
                      >
                        <XCircle className="w-3 h-3" /> {t("ui.common.reject")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InviteManager refreshKey={inviteRefreshKey} />

      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onCreated={() => setInviteRefreshKey((k) => k + 1)}
        />
      )}
      {approveTarget && (
        <ApproveModal row={approveTarget} onClose={() => setApproveTarget(null)} onApproved={load} />
      )}
      {rejectTarget && (
        <RejectModal row={rejectTarget} onClose={() => setRejectTarget(null)} onRejected={load} />
      )}
    </div>
  );
}
