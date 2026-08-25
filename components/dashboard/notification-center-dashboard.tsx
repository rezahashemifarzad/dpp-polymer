"use client";

/**
 * components/dashboard/notification-center-dashboard.tsx
 * -----------------------------------------------------------------------
 * Phase 7 - Step 1: Automated Notification & Webhook Suite — the client
 * dashboard behind /admin/notifications. Renders the SSR-fetched initial
 * data immediately (no loading flash, matching every other /admin/*
 * dashboard's pattern — see audit-log-dashboard.tsx), then re-fetches on
 * demand after any mutation.
 *
 * Four independent sections, each with its own local state:
 *   1. Overview — reuses the same expiry-tier chip pattern as
 *      expiry-alert-banner.tsx (Expired/Urgent/Soon) plus new chips for
 *      pending compliance anomalies, email configuration, active webhook
 *      count, and recent delivery failures. "Run Sweep Now" triggers the
 *      combined check (lib/actions/run-notification-sweep.ts).
 *   2. Notification Settings — email toggle/recipients, which expiry
 *      tiers actually notify, and the anomaly-notifications toggle.
 *   3. Webhook Endpoints — add/list/toggle/delete/test outbound
 *      integrations. A newly-created endpoint's signing secret is shown
 *      exactly once, in a dismissable panel, and never fetched again
 *      (see lib/services/webhook-endpoints.ts's own comment on why).
 *   4. Delivery Log — recent NotificationLog rows across both channels.
 *
 * All mutations go through Server Actions (lib/actions/*.ts) — this page
 * has no session auth yet either, so it uses the same "runs entirely
 * server-side, no RBAC key needed for the in-app path" convention as
 * every other admin mutation in this app.
 */

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  Mail,
  RefreshCw,
  Loader2,
  Plus,
  Trash2,
  Send,
  AlertTriangle,
  AlertOctagon,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Check,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
  Webhook as WebhookIcon,
  Power,
  Info,
} from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { runNotificationSweepAction } from "@/lib/actions/run-notification-sweep";
import { createWebhookEndpointAction } from "@/lib/actions/create-webhook-endpoint";
import { updateWebhookEndpointAction } from "@/lib/actions/update-webhook-endpoint";
import { deleteWebhookEndpointAction } from "@/lib/actions/delete-webhook-endpoint";
import { testWebhookEndpointAction } from "@/lib/actions/test-webhook-endpoint";
import { updateNotificationSettingsAction } from "@/lib/actions/update-notification-settings";

// ----------------------------------------------------------------------------
// Types — mirror the service layer's return shapes (see
// lib/services/notification-service.ts, lib/services/webhook-endpoints.ts,
// lib/services/notification-settings.ts).
// ----------------------------------------------------------------------------

type ExpiryTier = "EXPIRING_SOON" | "EXPIRING_URGENT" | "EXPIRED";
type NotificationEventType = "CERT_EXPIRY_SOON" | "CERT_EXPIRY_URGENT" | "CERT_EXPIRED" | "COC_ANOMALY_FLAGGED";
type NotificationChannel = "EMAIL" | "WEBHOOK";
type NotificationDeliveryStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

interface PortfolioExpiryAlertSummary {
  expiredCount: number;
  expiringUrgentCount: number;
  expiringSoonCount: number;
  thresholds: { expiringSoonDays: number; expiringUrgentDays: number };
}

interface NotificationLogRow {
  id: string;
  eventType: NotificationEventType;
  severity: ExpiryTier | null;
  batchId: string;
  title: string;
  message: string;
  channel: NotificationChannel;
  webhookEndpointId: string | null;
  webhookEndpointUrl: string | null;
  status: NotificationDeliveryStatus;
  responseCode: number | null;
  errorMessage: string | null;
  createdAt: string;
}

interface NotificationCenterSummary {
  expiryAlerts: PortfolioExpiryAlertSummary;
  pendingAnomalyCount: number;
  emailConfigured: boolean;
  activeWebhookCount: number;
  recentFailureCount: number;
  recentLog: NotificationLogRow[];
}

interface WebhookEndpointSummary {
  id: string;
  url: string;
  description: string | null;
  eventTypes: NotificationEventType[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt: string | null;
  lastStatus: NotificationDeliveryStatus | null;
  lastResponseCode: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  totalDeliveries: number;
  totalFailures: number;
}

interface NotificationSettingsView {
  id: string;
  emailEnabled: boolean;
  emailRecipients: string[];
  notifyOnTiers: ExpiryTier[];
  anomalyNotificationsEnabled: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

interface NotificationCenterDashboardProps {
  initialSummary: NotificationCenterSummary;
  initialWebhooks: WebhookEndpointSummary[];
  initialSettings: NotificationSettingsView;
}

const ALL_EVENT_TYPES: { value: NotificationEventType; label: string }[] = [
  { value: "CERT_EXPIRY_SOON", label: "Cert expiring soon" },
  { value: "CERT_EXPIRY_URGENT", label: "Cert expiring urgently" },
  { value: "CERT_EXPIRED", label: "Cert expired" },
  { value: "COC_ANOMALY_FLAGGED", label: "Chain-of-custody flagged" },
];

const ALL_TIERS: { value: ExpiryTier; label: string }[] = [
  { value: "EXPIRING_SOON", label: "Expiring Soon" },
  { value: "EXPIRING_URGENT", label: "Expiring Urgent" },
  { value: "EXPIRED", label: "Expired" },
];

function SummaryChip({ Icon, label, count, cls }: { Icon: typeof Bell; label: string; count: number | string; cls: string }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 ${cls}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <div className="min-w-0">
        <div className="text-lg font-extrabold font-mono leading-none">{count}</div>
        <div className="text-[10px] font-mono uppercase tracking-wide opacity-80 mt-1">{label}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: NotificationDeliveryStatus }) {
  const cls =
    status === "SENT"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : status === "FAILED"
        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
        : status === "SKIPPED"
          ? "bg-slate-800 text-slate-400 border-slate-700"
          : "bg-amber-500/10 text-amber-400 border-amber-500/30";
  return <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${cls}`}>{status}</span>;
}

function ChannelBadge({ channel }: { channel: NotificationChannel }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border bg-slate-800 text-slate-300 border-slate-700">
      {channel === "EMAIL" ? <Mail className="w-3 h-3" /> : <WebhookIcon className="w-3 h-3" />}
      {channel}
    </span>
  );
}

export function NotificationCenterDashboard({ initialSummary, initialWebhooks, initialSettings }: NotificationCenterDashboardProps) {
  const { push } = useToast();

  const [summary, setSummary] = useState(initialSummary);
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [settings, setSettings] = useState(initialSettings);

  const [sweeping, setSweeping] = useState(false);
  const [logExpanded, setLogExpanded] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);
  const [emailEnabledDraft, setEmailEnabledDraft] = useState(initialSettings.emailEnabled);
  const [recipientsDraft, setRecipientsDraft] = useState(initialSettings.emailRecipients.join(", "));
  const [tiersDraft, setTiersDraft] = useState<Set<ExpiryTier>>(new Set(initialSettings.notifyOnTiers));
  const [anomalyDraft, setAnomalyDraft] = useState(initialSettings.anomalyNotificationsEnabled);

  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newEventTypes, setNewEventTypes] = useState<Set<NotificationEventType>>(new Set(ALL_EVENT_TYPES.map((e) => e.value)));
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; secret: string } | null>(null);
  const [busyWebhookId, setBusyWebhookId] = useState<string | null>(null);

  async function refreshLog() {
    try {
      const res = await fetch("/api/notifications/log", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.success) {
        setSummary((prev) => ({ ...prev, recentLog: json.data, recentFailureCount: json.data.filter((r: NotificationLogRow) => r.status === "FAILED").length }));
      }
    } catch {
      // Best-effort refresh — the SSR/last-known log stays on screen if this fails.
    }
  }

  const handleRunSweep = async () => {
    setSweeping(true);
    try {
      const result = await runNotificationSweepAction();
      if (!result.ok || !result.data) throw new Error(result.error || "Failed to run the notification sweep");
      const { expiryCheck, expiryNotifications, anomalySweep } = result.data;
      push({
        variant: "success",
        title: "Notification sweep complete",
        description: `${expiryCheck.newAlerts + expiryCheck.escalated} cert escalation(s), ${expiryNotifications.dispatched} notification(s) sent, ${anomalySweep.dispatched} anomaly alert(s) dispatched.`,
      });
      await refreshLog();
    } catch (err) {
      push({ variant: "error", title: "Sweep failed", description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setSweeping(false);
    }
  };

  const toggleTierDraft = (tier: ExpiryTier) => {
    setTiersDraft((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const emailRecipients = recipientsDraft
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      const result = await updateNotificationSettingsAction({
        emailEnabled: emailEnabledDraft,
        emailRecipients,
        notifyOnTiers: Array.from(tiersDraft),
        anomalyNotificationsEnabled: anomalyDraft,
      });
      if (!result.ok || !result.data) throw new Error(result.error || "Failed to save settings");
      setSettings(result.data);
      push({ variant: "success", title: "Notification settings saved" });
    } catch (err) {
      push({ variant: "error", title: "Couldn't save settings", description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleNewEventType = (value: NotificationEventType) => {
    setNewEventTypes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const handleCreateWebhook = async () => {
    if (!newUrl.trim() || newEventTypes.size === 0) return;
    setCreatingWebhook(true);
    try {
      const result = await createWebhookEndpointAction({
        url: newUrl.trim(),
        description: newDescription.trim() || undefined,
        eventTypes: Array.from(newEventTypes),
      });
      if (!result.ok || !result.data) throw new Error(result.error || "Failed to create webhook endpoint");
      const { secret, ...rest } = result.data;
      setWebhooks((prev) => [rest, ...prev]);
      setRevealedSecret({ id: rest.id, secret });
      setNewUrl("");
      setNewDescription("");
      setNewEventTypes(new Set(ALL_EVENT_TYPES.map((e) => e.value)));
      setShowAddWebhook(false);
      push({ variant: "success", title: "Webhook endpoint added" });
    } catch (err) {
      push({ variant: "error", title: "Couldn't add webhook", description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleToggleActive = async (endpoint: WebhookEndpointSummary) => {
    setBusyWebhookId(endpoint.id);
    try {
      const result = await updateWebhookEndpointAction(endpoint.id, { isActive: !endpoint.isActive });
      if (!result.ok || !result.data) throw new Error(result.error || "Failed to update webhook endpoint");
      setWebhooks((prev) => prev.map((w) => (w.id === endpoint.id ? result.data! : w)));
    } catch (err) {
      push({ variant: "error", title: "Couldn't update webhook", description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setBusyWebhookId(null);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    setBusyWebhookId(id);
    try {
      const result = await deleteWebhookEndpointAction(id);
      if (!result.ok) throw new Error(result.error || "Failed to delete webhook endpoint");
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      if (revealedSecret?.id === id) setRevealedSecret(null);
      push({ variant: "success", title: "Webhook endpoint deleted" });
    } catch (err) {
      push({ variant: "error", title: "Couldn't delete webhook", description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setBusyWebhookId(null);
    }
  };

  const handleTestWebhook = async (id: string) => {
    setBusyWebhookId(id);
    try {
      const result = await testWebhookEndpointAction(id);
      if (!result.ok || !result.data) throw new Error(result.error || "Failed to send test webhook");
      push({
        variant: result.data.delivered ? "success" : "error",
        title: result.data.delivered ? "Test webhook delivered" : "Test webhook failed",
        description: result.data.error ?? `Responded with HTTP ${result.data.responseCode ?? "—"}`,
      });
      await refreshLog();
      const res = await fetch("/api/notifications/webhooks", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.success) setWebhooks(json.data);
    } catch (err) {
      push({ variant: "error", title: "Couldn't send test webhook", description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setBusyWebhookId(null);
    }
  };

  const handleCopySecret = async () => {
    if (!revealedSecret) return;
    try {
      await navigator.clipboard.writeText(revealedSecret.secret);
      push({ variant: "success", title: "Secret copied to clipboard" });
    } catch {
      push({ variant: "error", title: "Couldn't copy — select and copy the secret manually" });
    }
  };

  const totalFlagged = summary.expiryAlerts.expiredCount + summary.expiryAlerts.expiringUrgentCount + summary.expiryAlerts.expiringSoonCount;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans overflow-x-hidden">
      <header className="border-b border-slate-800/80 bg-[#070c18]/90 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-16 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-lg transition-all shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Admin Console
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-400 shrink-0" />
                Notifications &amp; Webhooks
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">
                Automated compliance alerts, email notifications, and outbound webhook integrations
              </p>
            </div>
          </div>
          <button
            onClick={handleRunSweep}
            disabled={sweeping}
            className="flex items-center gap-1.5 text-[11px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition-all shrink-0"
            title="Run the certificate-expiry check and compliance anomaly sweep now, dispatching any due notifications"
          >
            {sweeping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Run Sweep Now
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Overview */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            {totalFlagged === 0 && summary.pendingAnomalyCount === 0 ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            )}
            Overview
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <SummaryChip Icon={AlertOctagon} label="Expired" count={summary.expiryAlerts.expiredCount} cls="bg-rose-500/10 border-rose-500/30 text-rose-400" />
            <SummaryChip Icon={AlertTriangle} label="Urgent" count={summary.expiryAlerts.expiringUrgentCount} cls="bg-orange-500/10 border-orange-500/30 text-orange-400" />
            <SummaryChip Icon={Clock} label="Soon" count={summary.expiryAlerts.expiringSoonCount} cls="bg-amber-500/10 border-amber-500/30 text-amber-400" />
            <SummaryChip Icon={ShieldAlert} label="Anomalies" count={summary.pendingAnomalyCount} cls="bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400" />
            <SummaryChip Icon={WebhookIcon} label="Active Webhooks" count={summary.activeWebhookCount} cls="bg-cyan-500/10 border-cyan-500/30 text-cyan-400" />
            <SummaryChip Icon={Mail} label={summary.emailConfigured ? "Email Ready" : "Email Off"} count={summary.recentFailureCount} cls={summary.emailConfigured ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400"} />
          </div>
          {!summary.emailConfigured && settings.emailEnabled && (
            <div className="mt-3 flex items-start gap-1.5 text-[11px] text-amber-400 font-mono bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Email is enabled but not configured — set RESEND_API_KEY and DPP_NOTIFICATION_EMAIL_FROM in your environment to actually send emails.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Notification Settings */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" />
              Notification Settings
            </h2>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-xs text-slate-300">Email notifications</span>
              <button
                type="button"
                onClick={() => setEmailEnabledDraft((v) => !v)}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${emailEnabledDraft ? "bg-emerald-500" : "bg-slate-700"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${emailEnabledDraft ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </label>

            <div>
              <span className="text-[11px] text-slate-400 font-mono block mb-1.5">Recipients (comma-separated)</span>
              <input
                type="text"
                value={recipientsDraft}
                onChange={(e) => setRecipientsDraft(e.target.value)}
                placeholder="compliance@example.com, ops@example.com"
                className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-mono block mb-1.5">Notify on expiry tiers</span>
              <div className="flex flex-wrap gap-2">
                {ALL_TIERS.map((tier) => {
                  const active = tiersDraft.has(tier.value);
                  return (
                    <button
                      key={tier.value}
                      type="button"
                      onClick={() => toggleTierDraft(tier.value)}
                      className={`text-[11px] font-mono px-3 py-1.5 rounded-lg border transition ${
                        active ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400" : "bg-slate-950 border-slate-800 text-slate-500"
                      }`}
                    >
                      {active ? <Check className="w-3 h-3 inline mr-1" /> : null}
                      {tier.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-xs text-slate-300">Compliance anomaly notifications</span>
              <button
                type="button"
                onClick={() => setAnomalyDraft((v) => !v)}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${anomalyDraft ? "bg-emerald-500" : "bg-slate-700"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${anomalyDraft ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </label>

            <button
              onClick={handleSaveSettings}
              disabled={savingSettings || tiersDraft.size === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl transition text-xs"
            >
              {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
            {settings.updatedBy && (
              <p className="text-[10px] text-slate-600 font-mono">
                Last updated by {settings.updatedBy} · {new Date(settings.updatedAt).toLocaleString()}
              </p>
            )}
          </div>

          {/* Webhook Endpoints */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <WebhookIcon className="w-4 h-4 text-emerald-400" />
                Webhook Endpoints
              </h2>
              <button
                onClick={() => setShowAddWebhook((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add Webhook
              </button>
            </div>

            {revealedSecret && (
              <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-3 space-y-2">
                <p className="text-[11px] text-amber-400 font-mono flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Signing secret — copy it now, it will never be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 text-[10px] font-mono text-slate-200 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 truncate">
                    {revealedSecret.secret}
                  </code>
                  <button
                    onClick={handleCopySecret}
                    className="shrink-0 flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-2 rounded-lg"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setRevealedSecret(null)}
                    className="shrink-0 flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-2 rounded-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {showAddWebhook && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-3">
                <input
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://your-endpoint.example.com/hooks/dpp"
                  className="w-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
                <div className="flex flex-wrap gap-1.5">
                  {ALL_EVENT_TYPES.map((et) => {
                    const active = newEventTypes.has(et.value);
                    return (
                      <button
                        key={et.value}
                        type="button"
                        onClick={() => toggleNewEventType(et.value)}
                        className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border transition ${
                          active ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400" : "bg-slate-900 border-slate-800 text-slate-500"
                        }`}
                      >
                        {et.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={handleCreateWebhook}
                  disabled={creatingWebhook || !newUrl.trim() || newEventTypes.size === 0}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold rounded-lg transition text-xs"
                >
                  {creatingWebhook ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  {creatingWebhook ? "Adding..." : "Add Webhook"}
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {webhooks.length === 0 ? (
                <p className="text-xs text-slate-500 font-mono text-center py-6">No webhook endpoints configured yet.</p>
              ) : (
                webhooks.map((endpoint) => (
                  <div key={endpoint.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-slate-200 truncate" title={endpoint.url}>
                          {endpoint.url}
                        </p>
                        {endpoint.description && <p className="text-[10px] text-slate-500 mt-0.5">{endpoint.description}</p>}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {endpoint.eventTypes.map((et) => (
                            <span key={et} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {et}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleActive(endpoint)}
                        disabled={busyWebhookId === endpoint.id}
                        title={endpoint.isActive ? "Active — click to pause" : "Paused — click to activate"}
                        className={`shrink-0 p-1.5 rounded-lg border ${
                          endpoint.isActive ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-500"
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-800/60">
                      <div className="flex items-center gap-2 min-w-0">
                        {endpoint.lastStatus && <StatusBadge status={endpoint.lastStatus} />}
                        <span className="text-[10px] text-slate-600 font-mono truncate">
                          {endpoint.totalDeliveries} sent
                          {endpoint.consecutiveFailures > 0 ? ` · ${endpoint.consecutiveFailures} failing` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleTestWebhook(endpoint.id)}
                          disabled={busyWebhookId === endpoint.id}
                          className="flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 px-2 py-1 rounded-lg"
                        >
                          {busyWebhookId === endpoint.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Test
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(endpoint.id)}
                          disabled={busyWebhookId === endpoint.id}
                          className="flex items-center gap-1 text-[10px] bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-400 px-2 py-1 rounded-lg"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {endpoint.lastError && (
                      <p className="text-[10px] text-rose-400/80 font-mono mt-1.5 break-all">{endpoint.lastError}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Delivery Log */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Delivery Log
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={refreshLog} className="flex items-center gap-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-all">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
              {summary.recentLog.length > 8 && (
                <button
                  onClick={() => setLogExpanded((v) => !v)}
                  className="flex items-center gap-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-all"
                >
                  {logExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {logExpanded ? "Show Less" : `Show All (${summary.recentLog.length})`}
                </button>
              )}
            </div>
          </div>

          {summary.recentLog.length === 0 ? (
            <p className="text-xs text-slate-500 font-mono text-center py-6">No notifications dispatched yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs min-w-[720px]">
                <thead>
                  <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Batch</th>
                    <th className="py-2 pr-3">Event</th>
                    <th className="py-2 pr-3">Channel</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(logExpanded ? summary.recentLog : summary.recentLog.slice(0, 8)).map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="py-2 pr-3 text-emerald-400 whitespace-nowrap">{row.batchId}</td>
                      <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">{row.eventType}</td>
                      <td className="py-2 pr-3">
                        <ChannelBadge channel={row.channel} />
                      </td>
                      <td className="py-2 pr-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="py-2 text-slate-500 max-w-xs truncate" title={row.errorMessage ?? row.message}>
                        {row.errorMessage ?? row.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
