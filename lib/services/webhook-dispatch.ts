/**
 * lib/services/webhook-dispatch.ts
 * -----------------------------------------------------------------------
 * Phase 7 - Step 1: Automated Notification & Webhook Suite.
 *
 * Low-level HTTP dispatch for one webhook delivery attempt — deliberately
 * has no knowledge of Prisma, NotificationLog, or WebhookEndpoint rows;
 * lib/services/notification-service.ts owns all persistence, this file
 * only knows how to sign and send one request. Kept dependency-free (Node's
 * built-in `crypto` + global `fetch`, no npm SDK) — the same "no new
 * dependency required to make the base feature work" posture already
 * documented for email dispatch in lib/services/email-dispatch.ts.
 *
 * Signing: HMAC-SHA256 over the raw JSON body, using the receiving
 * endpoint's own per-endpoint secret (WebhookEndpoint.secret — see that
 * model's comment in prisma/schema.prisma for why it's shown to the admin
 * only once). Sent as `X-DPP-Signature: sha256=<hex>` so a receiver can
 * verify authenticity the same way GitHub/Stripe-style webhook consumers
 * already expect: recompute the HMAC over the received raw body with their
 * copy of the secret and compare.
 */

import { createHmac, timingSafeEqual } from "crypto";

const WEBHOOK_TIMEOUT_MS = 10_000;

export interface WebhookDispatchPayload {
  eventType: string;
  eventId: string;
  occurredAt: string;
  batchId: string;
  severity: string | null;
  title: string;
  message: string;
  data: Record<string, unknown>;
}

export interface WebhookDispatchResult {
  ok: boolean;
  responseCode: number | null;
  error: string | null;
}

export function signWebhookPayload(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

/** Timing-safe comparison for a receiver-side (or test-endpoint-side)
 * signature check — exported for symmetry/reuse, mirrors lib/rbac.ts's own
 * safeCompare helper rather than a naive `===` string comparison. */
export function verifyWebhookSignature(secret: string, rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const expected = `sha256=${signWebhookPayload(secret, rawBody)}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Sends one signed webhook POST. Never throws — every failure mode (DNS,
 * timeout, non-2xx, network error) resolves to `{ ok: false, ... }` so the
 * caller can always persist a NotificationLog row and update
 * WebhookEndpoint bookkeeping without a try/catch of its own.
 */
export async function dispatchWebhook(url: string, secret: string, payload: WebhookDispatchPayload): Promise<WebhookDispatchResult> {
  const rawBody = JSON.stringify(payload);
  const signature = signWebhookPayload(secret, rawBody);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DPP-Signature": `sha256=${signature}`,
        "X-DPP-Event": payload.eventType,
        "User-Agent": "DPP-Polymer-Webhooks/1.0",
      },
      body: rawBody,
      signal: controller.signal,
    });
    return {
      ok: res.ok,
      responseCode: res.status,
      error: res.ok ? null : `Endpoint responded with HTTP ${res.status}`,
    };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      responseCode: null,
      error: isAbort
        ? `Request timed out after ${WEBHOOK_TIMEOUT_MS / 1000}s`
        : error instanceof Error
          ? error.message
          : "Unknown webhook dispatch error",
    };
  } finally {
    clearTimeout(timeout);
  }
}
