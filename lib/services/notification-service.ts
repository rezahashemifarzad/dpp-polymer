/**
 * lib/services/notification-service.ts
 * -----------------------------------------------------------------------
 * Phase 7 - Step 1: Automated Notification & Webhook Suite — the actual
 * "Notification & Alert Engine" the sprint asks for. Owns:
 *
 *   1. dispatchNotificationEvent() — the single fan-out point: given one
 *      logical compliance event, sends it to every enabled/eligible
 *      channel (email, each active subscribed WebhookEndpoint), persists
 *      one NotificationLog row per channel attempted, and writes exactly
 *      ONE NOTIFICATION_SENT AuditLog entry summarizing the whole event
 *      (never one AuditLog row per channel — see that AuditAction's own
 *      comment in prisma/schema.prisma). Writes nothing at all if no
 *      channel was eligible to attempt (email disabled, zero matching
 *      active webhooks) — a silent non-event, not a failure.
 *
 *   2. runExpiryNotificationDispatch() — consumes the `raisedEvents` list
 *      lib/services/expiry-alert-service.ts's runExpiryAlertCheck already
 *      computes (Phase 7 addition to that existing function — see its own
 *      comment), filters to whichever tiers NotificationSettings.notifyOnTiers
 *      currently cares about, and dispatches one event per surviving row.
 *      Deliberately does NOT re-derive escalation logic itself — the
 *      "certificate lifecycle service" (expiry-alert-service.ts) remains
 *      the single source of truth for "did this cert's tier just get
 *      worse," exactly as the sprint's "integrate cleanly with... the
 *      certificate lifecycle services" instruction asks.
 *
 *   3. runComplianceAnomalySweep() — the "compliance anomalies" half of
 *      the sprint: scans ChainOfCustodyRecord rows an Auditor has FLAGGED
 *      (docs already call FLAGGED "a reviewer's way of raising a
 *      compliance concern" — see that enum's comment) that haven't yet
 *      triggered a notification (anomalyNotifiedAt IS NULL — same
 *      "nullable notified-at, checked before firing again" idempotency
 *      pattern Certification.lastNotifiedLevel already established),
 *      dispatches one COC_ANOMALY_FLAGGED event per record, and marks it
 *      notified.
 *
 *   4. runNotificationSweep() — the combined entry point meant to run on a
 *      schedule (see app/api/notifications/sweep/route.ts): (1) the
 *      existing, unmodified runExpiryAlertCheck, (2)
 *      runExpiryNotificationDispatch on its result, (3)
 *      runComplianceAnomalySweep. One call does everything Phase 7 -
 *      Step 1 needs to run daily.
 *
 * Also exports the read helpers the admin notifications panel needs:
 * getRecentNotificationLog (delivery history) and
 * computeNotificationCenterSummary (the "pending alerts" overview —
 * reuses computePortfolioExpiryAlerts() from expiry-alert-service.ts
 * rather than re-querying certifications a second time, plus a live count
 * of not-yet-notified flagged chain-of-custody records).
 */

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import type { ExpiryAlertLevel, NotificationEventType, NotificationChannel, NotificationDeliveryStatus } from "@prisma/client";
import { wrapSchemaDrift } from "@/lib/services/schema-drift";
import { dispatchWebhook } from "@/lib/services/webhook-dispatch";
import { sendNotificationEmail, getEmailDispatchStatus, describeEmailNotConfigured } from "@/lib/services/email-dispatch";
import { getNotificationSettings } from "@/lib/services/notification-settings";
import {
  runExpiryAlertCheck,
  computePortfolioExpiryAlerts,
  type ExpiryAlertCheckResult,
  type RaisedExpiryEvent,
} from "@/lib/services/expiry-alert-service";

const TIER_TO_EVENT_TYPE: Record<Exclude<RaisedExpiryEvent["tier"], null>, NotificationEventType> = {
  EXPIRING_SOON: "CERT_EXPIRY_SOON",
  EXPIRING_URGENT: "CERT_EXPIRY_URGENT",
  EXPIRED: "CERT_EXPIRED",
};

export interface NotificationEventInput {
  eventType: NotificationEventType;
  severity: ExpiryAlertLevel | null;
  passportId: string;
  batchId: string;
  sourceType: "CERTIFICATION" | "CHAIN_OF_CUSTODY_RECORD";
  sourceId: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface ChannelOutcome {
  channel: NotificationChannel;
  webhookEndpointId: string | null;
  status: NotificationDeliveryStatus;
  responseCode: number | null;
  error: string | null;
}

export interface DispatchNotificationEventResult {
  attempted: boolean; // false when no channel was eligible — nothing was persisted
  outcomes: ChannelOutcome[];
}

/** The single fan-out point — see file banner. */
export async function dispatchNotificationEvent(actor: string, event: NotificationEventInput): Promise<DispatchNotificationEventResult> {
  const settings = await getNotificationSettings();
  const outcomes: ChannelOutcome[] = [];

  // --- Email channel --------------------------------------------------------
  if (settings.emailEnabled) {
    let status: NotificationDeliveryStatus;
    let error: string | null = null;

    const notConfigured = describeEmailNotConfigured();
    if (notConfigured || settings.emailRecipients.length === 0) {
      status = "SKIPPED";
      error = notConfigured ?? "No notification email recipients configured";
    } else {
      const html = `<p><strong>${escapeHtml(event.title)}</strong></p><p>${escapeHtml(event.message)}</p><p style="color:#64748b;font-size:12px">Batch: ${escapeHtml(event.batchId)}</p>`;
      const result = await sendNotificationEmail(
        settings.emailRecipients,
        `[Polymer DPP] ${event.title}`,
        `${event.message}\n\nBatch: ${event.batchId}`,
        html
      );
      status = result.ok ? "SENT" : result.skipped ? "SKIPPED" : "FAILED";
      error = result.error;
    }

    const log = await prisma.notificationLog.create({
      data: {
        eventType: event.eventType,
        severity: event.severity,
        passportId: event.passportId,
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        title: event.title,
        message: event.message,
        channel: "EMAIL",
        status,
        errorMessage: error,
      },
    });
    outcomes.push({ channel: "EMAIL", webhookEndpointId: null, status: log.status, responseCode: null, error });
  }

  // --- Webhook channel(s) -----------------------------------------------------
  const matchingEndpoints = await prisma.webhookEndpoint.findMany({
    where: { isActive: true, eventTypes: { has: event.eventType } },
  });

  for (const endpoint of matchingEndpoints) {
    const log = await prisma.notificationLog.create({
      data: {
        eventType: event.eventType,
        severity: event.severity,
        passportId: event.passportId,
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        title: event.title,
        message: event.message,
        channel: "WEBHOOK",
        webhookEndpointId: endpoint.id,
        status: "PENDING",
      },
    });

    const result = await dispatchWebhook(endpoint.url, endpoint.secret, {
      eventType: event.eventType,
      eventId: log.id,
      occurredAt: new Date().toISOString(),
      batchId: event.batchId,
      severity: event.severity,
      title: event.title,
      message: event.message,
      data: event.data ?? {},
    });

    const status: NotificationDeliveryStatus = result.ok ? "SENT" : "FAILED";
    await prisma.$transaction([
      prisma.notificationLog.update({
        where: { id: log.id },
        data: { status, responseCode: result.responseCode, errorMessage: result.error },
      }),
      prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: {
          lastTriggeredAt: new Date(),
          lastStatus: status,
          lastResponseCode: result.responseCode,
          lastError: result.error,
          consecutiveFailures: result.ok ? 0 : { increment: 1 },
          totalDeliveries: { increment: 1 },
          totalFailures: result.ok ? undefined : { increment: 1 },
        },
      }),
    ]);

    outcomes.push({ channel: "WEBHOOK", webhookEndpointId: endpoint.id, status, responseCode: result.responseCode, error: result.error });
  }

  if (outcomes.length === 0) {
    return { attempted: false, outcomes };
  }

  // Deliberately NOT wrapped in the same $transaction as the NotificationLog
  // writes above (unlike every other writeAuditLog call site in this app) —
  // those writes are interleaved with slow, external HTTP calls (email API,
  // webhook POSTs), and holding a DB transaction open across network I/O to
  // third parties is exactly the kind of long-running-transaction hazard
  // Postgres connection pooling (this app runs against pooled Neon) is
  // meant to avoid. This audit entry is instead written once, after every
  // channel has already been attempted and its own row committed — a
  // "notification was sent" fact recorded slightly after the fact, not
  // inside the same atomic unit as the sends themselves.
  await writeAuditLog(prisma, {
    passportId: event.passportId,
    action: "NOTIFICATION_SENT",
    actor,
    previousHash: null,
    newHash: null,
    metadata: {
      eventType: event.eventType,
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      batchId: event.batchId,
      channels: outcomes.map((o) => ({ channel: o.channel, webhookEndpointId: o.webhookEndpointId, status: o.status })),
    },
  });

  return { attempted: true, outcomes };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface ExpiryNotificationDispatchResult {
  eligible: number;
  dispatched: number;
  skippedByTierFilter: number;
}

/** Consumes runExpiryAlertCheck's raisedEvents — see file banner. */
export async function runExpiryNotificationDispatch(
  checkResult: ExpiryAlertCheckResult,
  actor: string
): Promise<ExpiryNotificationDispatchResult> {
  const settings = await getNotificationSettings();
  let dispatched = 0;
  let skippedByTierFilter = 0;

  for (const raised of checkResult.raisedEvents) {
    if (!settings.notifyOnTiers.includes(raised.tier)) {
      skippedByTierFilter++;
      continue;
    }
    const result = await dispatchNotificationEvent(actor, {
      eventType: TIER_TO_EVENT_TYPE[raised.tier],
      severity: raised.tier,
      passportId: raised.passportId,
      batchId: raised.batchId,
      sourceType: "CERTIFICATION",
      sourceId: raised.certificationId,
      title: `Certificate ${raised.tier === "EXPIRED" ? "expired" : "expiring"} — ${raised.batchId}`,
      message: `${raised.scheme} certificate ${raised.certificateId} for batch ${raised.batchId} is now ${raised.tier.replace(/_/g, " ").toLowerCase()}.`,
      data: { certificationId: raised.certificationId, scheme: raised.scheme, certificateId: raised.certificateId, tier: raised.tier, previousTier: raised.previousTier },
    });
    if (result.attempted) dispatched++;
  }

  return { eligible: checkResult.raisedEvents.length, dispatched, skippedByTierFilter };
}

export interface ComplianceAnomalySweepResult {
  evaluated: number;
  dispatched: number;
}

/** Scans newly-FLAGGED chain-of-custody records — see file banner. */
export async function runComplianceAnomalySweep(actor: string, referenceDate: Date = new Date()): Promise<ComplianceAnomalySweepResult> {
  const settings = await getNotificationSettings();
  if (!settings.anomalyNotificationsEnabled) {
    return { evaluated: 0, dispatched: 0 };
  }

  const flagged = await prisma.chainOfCustodyRecord.findMany({
    where: { status: "FLAGGED", anomalyNotifiedAt: null },
    select: {
      id: true,
      tier: true,
      participantName: true,
      reviewNotes: true,
      passportId: true,
      passport: { select: { batchId: true } },
    },
  });

  let dispatched = 0;
  for (const record of flagged) {
    const result = await dispatchNotificationEvent(actor, {
      eventType: "COC_ANOMALY_FLAGGED",
      severity: null,
      passportId: record.passportId,
      batchId: record.passport.batchId,
      sourceType: "CHAIN_OF_CUSTODY_RECORD",
      sourceId: record.id,
      title: `Chain-of-custody anomaly flagged — ${record.passport.batchId}`,
      message: `${record.tier.replace(/_/g, " ")} tier "${record.participantName}" was flagged by an auditor${record.reviewNotes ? `: ${record.reviewNotes}` : "."}`,
      data: { chainOfCustodyRecordId: record.id, tier: record.tier, participantName: record.participantName },
    });
    if (result.attempted) dispatched++;
    await prisma.chainOfCustodyRecord.update({ where: { id: record.id }, data: { anomalyNotifiedAt: referenceDate } });
  }

  return { evaluated: flagged.length, dispatched };
}

export interface NotificationSweepResult {
  checkedAt: string;
  expiryCheck: Pick<ExpiryAlertCheckResult, "evaluated" | "newAlerts" | "escalated" | "unchanged">;
  expiryNotifications: ExpiryNotificationDispatchResult;
  anomalySweep: ComplianceAnomalySweepResult;
}

/** The combined scheduled entry point — see file banner. */
export async function runNotificationSweep(actor: string, referenceDate: Date = new Date()): Promise<NotificationSweepResult> {
  const checkResult = await runExpiryAlertCheck(actor, referenceDate);
  const expiryNotifications = await runExpiryNotificationDispatch(checkResult, actor);
  const anomalySweep = await runComplianceAnomalySweep(actor, referenceDate);

  return {
    checkedAt: checkResult.checkedAt,
    expiryCheck: {
      evaluated: checkResult.evaluated,
      newAlerts: checkResult.newAlerts,
      escalated: checkResult.escalated,
      unchanged: checkResult.unchanged,
    },
    expiryNotifications,
    anomalySweep,
  };
}

// ----------------------------------------------------------------------------
// Read helpers for the admin Notifications panel
// ----------------------------------------------------------------------------

export interface NotificationLogRow {
  id: string;
  eventType: NotificationEventType;
  severity: ExpiryAlertLevel | null;
  batchId: string;
  sourceType: string;
  sourceId: string;
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

const MAX_LOG_ROWS = 100;

export async function getRecentNotificationLog(limit: number = MAX_LOG_ROWS): Promise<NotificationLogRow[]> {
  const rows = await wrapSchemaDrift(() =>
    prisma.notificationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, MAX_LOG_ROWS),
      include: {
        passport: { select: { batchId: true } },
        webhookEndpoint: { select: { id: true, url: true } },
      },
    })
  );

  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    severity: row.severity,
    batchId: row.passport.batchId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    title: row.title,
    message: row.message,
    channel: row.channel,
    webhookEndpointId: row.webhookEndpointId,
    webhookEndpointUrl: row.webhookEndpoint?.url ?? null,
    status: row.status,
    responseCode: row.responseCode,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
  }));
}

export interface NotificationCenterSummary {
  expiryAlerts: Awaited<ReturnType<typeof computePortfolioExpiryAlerts>>;
  pendingAnomalyCount: number;
  emailConfigured: boolean;
  /** Names (never values) of the email env vars that are unset — lets the
   * admin UI say exactly what to configure instead of a generic warning. */
  emailMissingEnvVars: string[];
  activeWebhookCount: number;
  recentFailureCount: number; // FAILED deliveries in the log rows returned below
  recentLog: NotificationLogRow[];
}

/** Overview for the admin Notifications panel — reuses the existing
 * expiry-alert computation rather than re-querying certifications.
 *
 * Wrapped in wrapSchemaDrift(): WebhookEndpoint/NotificationLog and
 * ChainOfCustodyRecord.anomalyNotifiedAt were all added by the Phase 7
 * notification/webhook sprint, and this project has no migration history
 * (see lib/services/schema-drift.ts's file banner) — a database that
 * hasn't had `npx prisma db push` run against it since doesn't have them
 * yet. This function runs directly in app/admin/notifications/page.tsx's
 * server-rendered Promise.all with no try/catch of its own, so an
 * unwrapped P2021/P2022 here previously crashed the whole page render
 * (no error.tsx existed for this route either, compounding it into a
 * blank/default error page instead of an actionable message — both are
 * fixed together in this pass). */
export async function computeNotificationCenterSummary(): Promise<NotificationCenterSummary> {
  const [expiryAlerts, pendingAnomalyCount, activeWebhookCount, recentLog] = await wrapSchemaDrift(() =>
    Promise.all([
      computePortfolioExpiryAlerts(),
      prisma.chainOfCustodyRecord.count({ where: { status: "FLAGGED", anomalyNotifiedAt: null } }),
      prisma.webhookEndpoint.count({ where: { isActive: true } }),
      getRecentNotificationLog(50),
    ])
  );

  const emailStatus = getEmailDispatchStatus();
  return {
    expiryAlerts,
    pendingAnomalyCount,
    emailConfigured: emailStatus.configured,
    emailMissingEnvVars: emailStatus.missingEnvVars,
    activeWebhookCount,
    recentFailureCount: recentLog.filter((r) => r.status === "FAILED").length,
    recentLog,
  };
}
