"use server";

/**
 * lib/actions/submit-inquiry.ts
 * -----------------------------------------------------------------------
 * Server Action behind the landing page's inquiry form
 * (components/landing/contact-form.tsx). Validates the submission and
 * emails it to the official contact mailbox (info@dpp-polymer.de, see
 * CONTACT_EMAIL in lib/site-config.ts) through the existing Resend
 * dispatcher, with Reply-To set to the visitor's address so a reply goes
 * straight back to them.
 *
 * Public by design (listed in scripts/check-access-control.ts): visitors
 * have no session. A Server Action rather than a REST route for the same
 * reason as lib/actions/login.ts — Next.js verifies the request origin.
 * Nothing is written to the database; the email is the only record.
 *
 * Abuse limits: every field is length-capped (lib/inquiry.ts), the only
 * recipient is the fixed contact mailbox (a visitor can never choose where
 * mail goes), header values are stripped of line breaks, and a hidden
 * honeypot field silently drops naive bots. There is no rate limit here.
 */

import { sendNotificationEmail } from "@/lib/services/email-dispatch";
import { CONTACT_EMAIL } from "@/lib/site-config";
import {
  INQUIRY_HONEYPOT_FIELD,
  INQUIRY_TOPIC_LABELS,
  readInquiry,
  validateInquiry,
  type InquiryFieldErrors,
} from "@/lib/inquiry";

export type InquiryActionResult =
  | { ok: true }
  | { ok: false; code: "invalid"; fieldErrors: InquiryFieldErrors }
  /** Email delivery is not configured on this deployment. */
  | { ok: false; code: "unavailable" }
  /** The email provider rejected or failed the send. */
  | { ok: false; code: "failed" };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Collapses whitespace (including line breaks) for use in a mail header. */
function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export async function submitInquiryAction(formData: FormData): Promise<InquiryActionResult> {
  // Honeypot: report success so a bot learns nothing, but send nothing.
  const honeypot = formData.get(INQUIRY_HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return { ok: true };
  }

  const input = readInquiry(formData);
  const fieldErrors = validateInquiry(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, code: "invalid", fieldErrors };
  }

  const name = singleLine(input.name);
  const company = singleLine(input.company);
  const email = singleLine(input.email);
  const topic = INQUIRY_TOPIC_LABELS[input.topic];
  const language = singleLine(String(formData.get("locale") ?? "")).slice(0, 5) || "en";

  const subject = `[DPP-Polymer Inquiry] New Contact Form Submission from ${company}`;
  const rows: [string, string][] = [
    ["Full name", name],
    ["Company / organization", company],
    ["Business email", email],
    ["Topic", topic],
    ["Site language", language],
  ];
  const bodyText = `${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\nMessage:\n${input.message}\n`;
  const bodyHtml =
    `<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">` +
    rows
      .map(
        ([label, value]) =>
          `<tr><td style="color:#64748b;vertical-align:top">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`
      )
      .join("") +
    `</table>` +
    `<p style="font-family:Arial,sans-serif;font-size:14px;color:#64748b;margin:16px 0 4px">Message</p>` +
    `<p style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap;margin:0">${escapeHtml(input.message)}</p>`;

  const result = await sendNotificationEmail([CONTACT_EMAIL], subject, bodyText, bodyHtml, { replyTo: email });
  if (result.ok) {
    return { ok: true };
  }
  // Log the reason only — never the visitor's details or message.
  console.error(`[submit-inquiry] Inquiry email not sent: ${result.error ?? "unknown error"}`);
  return { ok: false, code: result.skipped ? "unavailable" : "failed" };
}
