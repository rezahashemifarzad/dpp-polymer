/**
 * lib/services/email-dispatch.ts
 * -----------------------------------------------------------------------
 * Phase 7 - Step 1: Automated Notification & Webhook Suite.
 *
 * Low-level email send via Resend's HTTP API (https://api.resend.com/emails)
 * using the platform's own global `fetch` — deliberately NOT the `resend`
 * npm SDK, so this feature's base functionality (webhooks, the in-app
 * pending-alerts view, delivery logging) needs no new dependency installed
 * to compile and run; only actually SENDING an email requires the two env
 * vars below to be configured. Resend was picked over SMTP/nodemailer
 * specifically because its API is a single authenticated POST with a JSON
 * body — no library, no connection pooling, no port 25/587 firewall
 * concerns in a serverless (Vercel) deployment.
 *
 * Env vars (see isEmailDispatchConfigured below):
 *   RESEND_API_KEY            — Resend API key (dashboard: resend.com/api-keys).
 *                               Required to send.
 *   DPP_NOTIFICATION_EMAIL_FROM — optional sender override. Defaults to the
 *                               official mailbox, "DPP-Polymer <info@dpp-polymer.de>"
 *                               (DEFAULT_EMAIL_FROM); the dpp-polymer.de domain
 *                               must be verified in Resend (resend.com/domains).
 *
 * Every email carries Reply-To: info@dpp-polymer.de by default, so replies
 * land in the official mailbox whatever the sender is. A caller can pass
 * options.replyTo instead (the inquiry form sets it to the visitor's
 * address — see lib/actions/submit-inquiry.ts).
 *
 * Without RESEND_API_KEY, sendNotificationEmail() returns
 * `{ ok: false, skipped: true, ... }` rather than throwing — the caller
 * (lib/services/notification-service.ts) turns that into a NotificationLog
 * row with status SKIPPED, so the admin notifications UI clearly shows
 * "email not configured" instead of a silent no-op or a crashed cron run.
 */

import { CONTACT_EMAIL, SITE } from "@/lib/site-config";

/** Sender used when DPP_NOTIFICATION_EMAIL_FROM is not set. */
export const DEFAULT_EMAIL_FROM = `${SITE.name} <${CONTACT_EMAIL}>`;

export interface EmailDispatchResult {
  ok: boolean;
  skipped: boolean;
  error: string | null;
}

/** The env vars email delivery needs. Names only — values are never
 * surfaced to the UI or logs. */
export const EMAIL_DISPATCH_ENV_VARS = ["RESEND_API_KEY"] as const;

export interface EmailDispatchStatus {
  configured: boolean;
  /** Names of the required env vars that are unset or blank. */
  missingEnvVars: string[];
}

/** Single source of truth for "can this deployment send email?". A value
 * that is present but whitespace-only (a common copy-paste slip in the
 * Vercel dashboard) counts as missing, so the UI never reports email as
 * ready when every send would fail. */
export function getEmailDispatchStatus(): EmailDispatchStatus {
  const missingEnvVars = EMAIL_DISPATCH_ENV_VARS.filter((name) => !process.env[name]?.trim());
  return { configured: missingEnvVars.length === 0, missingEnvVars };
}

export function isEmailDispatchConfigured(): boolean {
  return getEmailDispatchStatus().configured;
}

/** Human-readable reason recorded on a SKIPPED email NotificationLog row,
 * or null when email is configured. */
export function describeEmailNotConfigured(): string | null {
  const status = getEmailDispatchStatus();
  return status.configured
    ? null
    : `Email delivery not configured (missing: ${status.missingEnvVars.join(", ")}) — notification kept in-app only`;
}

export async function sendNotificationEmail(
  recipients: string[],
  subject: string,
  bodyText: string,
  bodyHtml: string,
  options: { replyTo?: string } = {}
): Promise<EmailDispatchResult> {
  const notConfigured = describeEmailNotConfigured();
  if (notConfigured) {
    return { ok: false, skipped: true, error: notConfigured };
  }
  const apiKey = process.env.RESEND_API_KEY!.trim();
  const from = process.env.DPP_NOTIFICATION_EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM;
  if (recipients.length === 0) {
    return { ok: false, skipped: true, error: "No notification email recipients configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        reply_to: options.replyTo?.trim() || CONTACT_EMAIL,
        to: recipients,
        subject,
        text: bodyText,
        html: bodyHtml,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, skipped: false, error: `Resend API responded with HTTP ${res.status}${body ? `: ${body.slice(0, 300)}` : ""}` };
    }
    return { ok: true, skipped: false, error: null };
  } catch (error) {
    return { ok: false, skipped: false, error: error instanceof Error ? error.message : "Unknown email dispatch error" };
  }
}
