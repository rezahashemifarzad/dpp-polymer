/**
 * components/dashboard/reach-ppwr/svhc-status-badge.tsx
 * -----------------------------------------------------------------------
 * One shared, color-coded status chip for a passport's REACH Article 33
 * SVHC status — same "one place owns the color/icon/label mapping"
 * rationale as components/dashboard/expiry-alert-badge.tsx, and the same
 * severity convention: never color alone (a distinct icon + text label
 * always accompanies it), so the signal survives for colorblind readers
 * and in grayscale print exports.
 *
 * NOT_ASSESSED is deliberately its own visually distinct (slate, muted)
 * state rather than defaulting to look like NONE_DECLARED's "all clear"
 * green — conflating the two here would undo the entire point of
 * prisma/schema.prisma's SvhcStatus enum having three states instead of a
 * boolean.
 */

import { ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";
import type { SvhcStatusValue } from "@/lib/hooks/use-passports";

const STATUS_META: Record<SvhcStatusValue, { cls: string; Icon: typeof ShieldCheck; label: string }> = {
  NOT_ASSESSED: { cls: "bg-slate-500/10 text-slate-400 border-slate-500/30", Icon: ShieldAlert, label: "Not Assessed" },
  NONE_DECLARED: { cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", Icon: ShieldCheck, label: "None Declared" },
  SVHC_PRESENT: { cls: "bg-amber-500/10 text-amber-400 border-amber-500/30", Icon: AlertTriangle, label: "SVHC Present" },
};

export function SvhcStatusBadge({ status, size = "sm" }: { status: SvhcStatusValue; size?: "sm" | "xs" }) {
  const { cls, Icon, label } = STATUS_META[status];
  const sizeCls = size === "xs" ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5";

  return (
    <span className={`inline-flex items-center gap-1 ${sizeCls} ${cls} border rounded-full font-semibold whitespace-nowrap`}>
      <Icon className="w-3 h-3 shrink-0" />
      {label}
    </span>
  );
}
