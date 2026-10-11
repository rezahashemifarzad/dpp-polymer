/**
 * lib/inquiry.ts
 * -----------------------------------------------------------------------
 * Shared shape and validation for the landing page's inquiry form
 * (components/landing/contact-form.tsx). Deliberately a plain module with
 * no server-only imports: the browser runs validateInquiry() for instant
 * feedback and the Server Action (lib/actions/submit-inquiry.ts) runs the
 * very same function again as the real check, so the two can never drift.
 */

export const INQUIRY_TOPICS = ["general", "pilot", "compliance", "partnership"] as const;
export type InquiryTopic = (typeof INQUIRY_TOPICS)[number];

/** English topic names used in the email sent to the contact mailbox. */
export const INQUIRY_TOPIC_LABELS: Record<InquiryTopic, string> = {
  general: "General Inquiry",
  pilot: "Pilot Testing",
  compliance: "Compliance & Regulatory Setup",
  partnership: "Partnership",
};

export const INQUIRY_LIMITS = { name: 120, company: 160, email: 254, message: 5000 } as const;

/** Hidden field real visitors never fill in; bots that do are dropped. */
export const INQUIRY_HONEYPOT_FIELD = "website";

export interface InquiryInput {
  name: string;
  company: string;
  email: string;
  topic: InquiryTopic;
  message: string;
}

export type InquiryField = "name" | "company" | "email" | "message";
export type InquiryFieldError = "required" | "invalidEmail" | "tooLong";
export type InquiryFieldErrors = Partial<Record<InquiryField, InquiryFieldError>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Reads and trims the form fields. An unknown topic falls back to "general". */
export function readInquiry(formData: FormData): InquiryInput {
  const topic = text(formData.get("topic"));
  return {
    name: text(formData.get("name")),
    company: text(formData.get("company")),
    email: text(formData.get("email")),
    topic: (INQUIRY_TOPICS as readonly string[]).includes(topic) ? (topic as InquiryTopic) : "general",
    message: text(formData.get("message")),
  };
}

/** Returns one error code per invalid field; an empty object means valid. */
export function validateInquiry(input: InquiryInput): InquiryFieldErrors {
  const errors: InquiryFieldErrors = {};
  for (const field of ["name", "company", "email", "message"] as const) {
    if (!input[field]) errors[field] = "required";
    else if (input[field].length > INQUIRY_LIMITS[field]) errors[field] = "tooLong";
  }
  if (!errors.email && !EMAIL_PATTERN.test(input.email)) errors.email = "invalidEmail";
  return errors;
}
