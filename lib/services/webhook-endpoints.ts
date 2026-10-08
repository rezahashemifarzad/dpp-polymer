/**
 * lib/services/webhook-endpoints.ts
 * -----------------------------------------------------------------------
 * Phase 7 - Step 1: Automated Notification & Webhook Suite — CRUD for
 * WebhookEndpoint rows (see prisma/schema.prisma's own comment on that
 * model), plus a "send a test ping" action. Pure data-layer + validation;
 * actual delivery for a real event goes through
 * lib/services/notification-service.ts, which calls dispatchWebhook
 * (lib/services/webhook-dispatch.ts) directly — this file's own
 * testWebhookEndpoint is the ONE place outside that main dispatch path
 * that also calls it, for the admin UI's "Send Test" button.
 *
 * `secret` is generated here with `randomBytes(32).toString("hex")` — same
 * convention as lib/services/supplier-submission.ts's raw invite token —
 * and returned to the caller exactly once, at creation. Every other read
 * (listWebhookEndpoints) omits it entirely from the returned shape rather
 * than masking it, so there is no code path that can leak it back out
 * after the fact.
 */

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { wrapSchemaDrift } from "@/lib/services/schema-drift";
import { dispatchWebhook } from "@/lib/services/webhook-dispatch";
import type { NotificationEventType, NotificationDeliveryStatus } from "@prisma/client";

export const ALL_NOTIFICATION_EVENT_TYPES: NotificationEventType[] = [
  "CERT_EXPIRY_SOON",
  "CERT_EXPIRY_URGENT",
  "CERT_EXPIRED",
  "COC_ANOMALY_FLAGGED",
];

export interface WebhookEndpointSummary {
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

function toSummary(row: {
  id: string;
  url: string;
  description: string | null;
  eventTypes: NotificationEventType[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastTriggeredAt: Date | null;
  lastStatus: NotificationDeliveryStatus | null;
  lastResponseCode: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  totalDeliveries: number;
  totalFailures: number;
}): WebhookEndpointSummary {
  return {
    id: row.id,
    url: row.url,
    description: row.description,
    eventTypes: row.eventTypes,
    isActive: row.isActive,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastTriggeredAt: row.lastTriggeredAt ? row.lastTriggeredAt.toISOString() : null,
    lastStatus: row.lastStatus,
    lastResponseCode: row.lastResponseCode,
    lastError: row.lastError,
    consecutiveFailures: row.consecutiveFailures,
    totalDeliveries: row.totalDeliveries,
    totalFailures: row.totalFailures,
  };
}

// Wrapped in wrapSchemaDrift(): WebhookEndpoint is a Phase 7 table this
// project's no-migration-history setup (lib/services/schema-drift.ts's
// file banner) can leave un-pushed to a given database. This is the call
// app/admin/notifications/page.tsx's server-rendered Promise.all makes
// directly, so an unwrapped P2021 here previously crashed that page's
// render outright rather than surfacing a clear cause.
export async function listWebhookEndpoints(): Promise<WebhookEndpointSummary[]> {
  const rows = await wrapSchemaDrift(() => prisma.webhookEndpoint.findMany({ orderBy: { createdAt: "desc" } }));
  return rows.map(toSummary);
}

export interface CreateWebhookEndpointInput {
  url: string;
  description?: string;
  eventTypes: NotificationEventType[];
}

export type CreateWebhookEndpointResult =
  | { ok: true; status: 201; data: WebhookEndpointSummary & { secret: string } }
  | { ok: false; status: 400; error: string };

function isValidHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function createWebhookEndpoint(actor: string, input: CreateWebhookEndpointInput): Promise<CreateWebhookEndpointResult> {
  const url = input.url?.trim();
  if (!url || !isValidHttpsUrl(url)) {
    return { ok: false, status: 400, error: "url must be a valid https:// URL" };
  }
  const eventTypes = Array.from(new Set(input.eventTypes ?? [])).filter((t) => ALL_NOTIFICATION_EVENT_TYPES.includes(t));
  if (eventTypes.length === 0) {
    return { ok: false, status: 400, error: "At least one valid eventType must be selected" };
  }

  const secret = randomBytes(32).toString("hex");

  const created = await prisma.webhookEndpoint.create({
    data: {
      url,
      description: input.description?.trim() || null,
      secret,
      eventTypes,
      createdBy: actor,
    },
  });

  return { ok: true, status: 201, data: { ...toSummary(created), secret } };
}

export interface UpdateWebhookEndpointInput {
  url?: string;
  description?: string | null;
  eventTypes?: NotificationEventType[];
  isActive?: boolean;
}

export type UpdateWebhookEndpointResult =
  | { ok: true; status: 200; data: WebhookEndpointSummary }
  | { ok: false; status: 400; error: string }
  | { ok: false; status: 404; error: string };

export async function updateWebhookEndpoint(id: string, input: UpdateWebhookEndpointInput): Promise<UpdateWebhookEndpointResult> {
  const existing = await prisma.webhookEndpoint.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, status: 404, error: `No webhook endpoint found for id "${id}"` };
  }

  if (input.url !== undefined && !isValidHttpsUrl(input.url.trim())) {
    return { ok: false, status: 400, error: "url must be a valid https:// URL" };
  }
  let eventTypes: NotificationEventType[] | undefined;
  if (input.eventTypes !== undefined) {
    eventTypes = Array.from(new Set(input.eventTypes)).filter((t) => ALL_NOTIFICATION_EVENT_TYPES.includes(t));
    if (eventTypes.length === 0) {
      return { ok: false, status: 400, error: "At least one valid eventType must be selected" };
    }
  }

  const updated = await prisma.webhookEndpoint.update({
    where: { id },
    data: {
      ...(input.url !== undefined ? { url: input.url.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(eventTypes !== undefined ? { eventTypes } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  return { ok: true, status: 200, data: toSummary(updated) };
}

export type DeleteWebhookEndpointResult = { ok: true; status: 200 } | { ok: false; status: 404; error: string };

export async function deleteWebhookEndpoint(id: string): Promise<DeleteWebhookEndpointResult> {
  const existing = await prisma.webhookEndpoint.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return { ok: false, status: 404, error: `No webhook endpoint found for id "${id}"` };
  }
  // NotificationLog.webhookEndpointId has no onDelete cascade configured
  // (Prisma's implicit default is Restrict for a required-side-optional
  // relation like this one) — clear the FK on any historical delivery rows
  // first so the endpoint itself can be deleted without losing that
  // history's other fields (title/message/status/etc. all stay intact,
  // only the now-dangling endpoint reference is nulled out).
  await prisma.$transaction([
    prisma.notificationLog.updateMany({ where: { webhookEndpointId: id }, data: { webhookEndpointId: null } }),
    prisma.webhookEndpoint.delete({ where: { id } }),
  ]);
  return { ok: true, status: 200 };
}

export type TestWebhookEndpointResult =
  | { ok: true; status: 200; data: { delivered: boolean; responseCode: number | null; error: string | null } }
  | { ok: false; status: 404; error: string };

/** Sends a synthetic ping payload to one endpoint on demand — does NOT
 * create a NotificationLog row (this is a connectivity check, not a real
 * notification event) but DOES update the endpoint's own delivery
 * bookkeeping, same as a real dispatch would, so "Send Test" gives an
 * admin an honest read on whether the endpoint is currently reachable. */
export async function testWebhookEndpoint(id: string): Promise<TestWebhookEndpointResult> {
  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id } });
  if (!endpoint) {
    return { ok: false, status: 404, error: `No webhook endpoint found for id "${id}"` };
  }

  const result = await dispatchWebhook(endpoint.url, endpoint.secret, {
    eventType: "TEST_PING",
    eventId: `test-${Date.now()}`,
    occurredAt: new Date().toISOString(),
    batchId: "N/A",
    severity: null,
    title: "DPP-Polymer — Test Webhook",
    message: "This is a test delivery triggered from the Notifications & Webhooks admin panel. No compliance event occurred.",
    data: {},
  });

  await prisma.webhookEndpoint.update({
    where: { id },
    data: {
      lastTriggeredAt: new Date(),
      lastStatus: result.ok ? "SENT" : "FAILED",
      lastResponseCode: result.responseCode,
      lastError: result.error,
      consecutiveFailures: result.ok ? 0 : { increment: 1 },
      totalDeliveries: { increment: 1 },
      totalFailures: result.ok ? undefined : { increment: 1 },
    },
  });

  return { ok: true, status: 200, data: { delivered: result.ok, responseCode: result.responseCode, error: result.error } };
}
