/**
 * components/dashboard/expiry-alert-badge.tsx
 * -----------------------------------------------------------------------
 * Phase 4 - Step 1: Automated Expiry & Compliance Alerts.
 *
 * One shared, color-coded status chip for a certification's (or a
 * passport's rolled-up) expiry tier — used by the new portfolio-wide
 * Compliance Alerts widget (expiry-alert-banner.tsx), the new read-only
 * Certifications panel in batch-details-modal.tsx, and the existing
 * Material Ledger "Compliance" column in app/admin/page.tsx (refactored
 * here to use this component instead of its own hand-rolled markup, so
 * there's one place that owns the color/icon/label mapping).
 *
 * Accepts the 2-tier ExpiryAlertLevel from lib/utils/certification-status.ts
 * (getCertificationAlertLevel — "EXPIRED" | "EXPIRING_SOON" | null) as well
 * as the newer 3-tier ExpiryAlertTier (adds "EXPIRING_URGENT") — the
 * 2-tier type is a strict subset, so every existing caller's value is
 * already valid input.
 *
 * Status colors follow this app's severity convention: rose (critical /
 * already expired), orange (urgent / due this week), amber (warning / due
 * this month) — each paired with a distinct icon and text label, never
 * color alone, so the signal survives for colorblind readers and in
 * grayscale print exports.
 */

import { AlertTriangle, AlertOctagon, Clock } from "lucide-react";

export type ExpiryBadgeTier = "EXPIRED" | "EXPIRING_URGENT" | "EXPIRING_SOON" | null;

const TIER_META: Record<
  Exclude<ExpiryBadgeTier, null>,
  { cls: string; Icon: typeof AlertTriangle; label: string }
> = {
  EXPIRED: { cls: "bg-rose-500/10 text-rose-400 border-rose-500/30", Icon: AlertOctagon, label: "Expired" },
  EXPIRING_URGENT: { cls: "bg-orange-500/10 text-orange-400 border-orange-500/30", Icon: AlertTriangle, label: "Urgent" },
  EXPIRING_SOON: { cls: "bg-amber-500/10 text-amber-400 border-amber-500/30", Icon: Clock, label: "Expiring Soon" },
};

export function ExpiryAlertBadge({
  tier,
  count,
  title,
  size = "sm",
}: {
  tier: ExpiryBadgeTier;
  /** Optional trailing "(N)" — e.g. how many certifications on this batch fall in this tier. */
  count?: number;
  title?: string;
  size?: "sm" | "xs";
}) {
  if (!tier) return <span className="text-slate-600">—</span>;
  const { cls, Icon, label } = TIER_META[tier];
  const sizeCls = size === "xs" ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center gap-1 ${sizeCls} ${cls} border rounded-full font-semibold whitespace-nowrap`}
      title={title}
    >
      <Icon className="w-3 h-3 shrink-0" />
      {label}
      {typeof count === "number" ? ` (${count})` : ""}
    </span>
  );
}

/** Small helper shared by the badge's callers for a human-readable "days
 * remaining" string, so the banner/list rows and any future caller phrase
 * it identically. */
export function formatDaysRemaining(daysRemaining: number): string {
  if (daysRemaining < 0) {
    const daysAgo = Math.abs(daysRemaining);
    return `Expired ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
  }
  if (daysRemaining === 0) return "Expires today";
  return `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`;
}
