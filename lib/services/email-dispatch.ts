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
 * Required env vars (both optional — see isEmailDispatchConfigured below):
 *   RESEND_API_KEY            — Resend API key (dashboard: resend.com/api-keys)
 *   DPP_NOTIFICATION_EMAIL_FROM — verified sender address/domain in Resend
 *
 * Neither is set by default in this project's .env (confirmed — DATABASE_URL
 * only). Without them, sendNotificationEmail() returns
 * `{ ok: false, skipped: true, ... }` rather than throwing — the caller
 * (lib/services/notification-service.ts) turns that into a NotificationLog
 * row with status SKIPPED, so the admin notifications UI clearly shows
 * "email not configured" instead of a silent no-op or a crashed cron run.
 */

export interface EmailDispatchResult {
  ok: boolean;
  skipped: boolean;
  error: string | null;
}

export function isEmailDispatchConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.DPP_NOTIFICATION_EMAIL_FROM);
}

export async function sendNotificationEmail(
  recipients: string[],
  subject: string,
  bodyText: string,
  bodyHtml: string
): Promise<EmailDispatchResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DPP_NOTIFICATION_EMAIL_FROM;

  if (!apiKey || !from) {
    return { ok: false, skipped: true, error: "Email dispatch not configured (RESEND_API_KEY / DPP_NOTIFICATION_EMAIL_FROM unset)" };
  }
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
