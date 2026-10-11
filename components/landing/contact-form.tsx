"use client";

/**
 * components/landing/contact-form.tsx
 * -----------------------------------------------------------------------
 * Inquiry form in the landing page's Contact section. Submits to
 * lib/actions/submit-inquiry.ts, which emails the inquiry to the official
 * contact mailbox. Validation runs here first for instant, translated
 * feedback (lib/inquiry.ts) and again on the server, which is the check
 * that counts.
 *
 * Shown inside the inquiry dialog (contact-dialog.tsx).
 *
 * States: idle → sending → success (the form is replaced by a thank-you
 * panel) or error (a message above the button; what was typed is kept).
 * Errors are announced to screen readers and focus moves to the first
 * invalid field.
 */

import { useRef, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { submitInquiryAction } from "@/lib/actions/submit-inquiry";
import {
  INQUIRY_HONEYPOT_FIELD,
  INQUIRY_LIMITS,
  INQUIRY_TOPICS,
  readInquiry,
  validateInquiry,
  type InquiryField,
  type InquiryFieldErrors,
} from "@/lib/inquiry";
import { CONTACT_EMAIL, type SiteLocale } from "@/lib/site-config";
import type { LandingCopy } from "@/lib/i18n/landing-dictionary";

interface ContactFormProps {
  locale: SiteLocale;
  copy: LandingCopy["contact"]["form"];
  /** When set, the success panel offers a close button with this label. */
  closeLabel?: string;
  onClose?: () => void;
  /** Reports whether the thank-you panel is showing. */
  onSentChange?: (sent: boolean) => void;
}

const FIELD_ORDER: readonly InquiryField[] = ["name", "company", "email", "message"];

const LABEL = "block text-[13px] font-semibold text-navy-900";
const CONTROL =
  "mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] text-navy-900 placeholder:text-slate-400 " +
  "transition-colors duration-150 focus:outline-2 focus:outline-offset-1 focus:outline-navy-700 disabled:opacity-60";
const CONTROL_OK = "border-slate-300 hover:border-slate-400";
const CONTROL_BAD = "border-rose-500";

export function ContactForm({ locale, copy, closeLabel, onClose, onSentChange }: ContactFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [fieldErrors, setFieldErrors] = useState<InquiryFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSentState] = useState(false);
  const setSent = (value: boolean) => {
    setSentState(value);
    onSentChange?.(value);
  };
  const [isPending, startTransition] = useTransition();

  const showErrors = (errors: InquiryFieldErrors) => {
    setFieldErrors(errors);
    const first = FIELD_ORDER.find((field) => errors[field]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;
    const formData = new FormData(event.currentTarget);
    setFormError(null);

    const errors = validateInquiry(readInquiry(formData));
    if (Object.keys(errors).length > 0) {
      showErrors(errors);
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      try {
        const result = await submitInquiryAction(formData);
        if (result.ok) {
          setSent(true);
        } else if (result.code === "invalid") {
          showErrors(result.fieldErrors);
        } else {
          setFormError(result.code === "unavailable" ? copy.errorUnavailable : copy.errorFailed);
        }
      } catch {
        setFormError(copy.errorFailed);
      }
    });
  };

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-start py-6">
        <CheckCircle2 className="h-9 w-9 text-teal-700" aria-hidden="true" />
        <h3 className="mt-5 text-xl font-semibold tracking-[-0.01em] text-navy-900">{copy.successTitle}</h3>
        <p className="mt-2 text-[15.5px] leading-[1.65] text-slate-600">{copy.successBody}</p>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
          {onClose && closeLabel && (
            <button
              type="button"
              onClick={onClose}
              autoFocus
              className="inline-flex h-11 items-center justify-center rounded-lg bg-navy-900 px-5 text-[14.5px] font-semibold text-white transition-colors duration-200 hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
            >
              {closeLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="rounded-sm text-[14px] font-semibold text-navy-900 underline decoration-slate-300 underline-offset-4 hover:decoration-navy-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy-700"
          >
            {copy.sendAnother}
          </button>
        </div>
      </div>
    );
  }

  const errorText = (field: InquiryField): string | null => {
    const code = fieldErrors[field];
    if (!code) return null;
    return code === "required" ? copy.errorRequired : code === "invalidEmail" ? copy.errorInvalidEmail : copy.errorTooLong;
  };

  const fieldProps = (field: InquiryField) => ({
    id: `inquiry-${field}`,
    name: field,
    required: true,
    maxLength: INQUIRY_LIMITS[field],
    disabled: isPending,
    "aria-invalid": fieldErrors[field] ? (true as const) : undefined,
    "aria-describedby": fieldErrors[field] ? `inquiry-${field}-error` : undefined,
    className: `${CONTROL} ${fieldErrors[field] ? CONTROL_BAD : CONTROL_OK}`,
    onChange: () => {
      if (fieldErrors[field]) setFieldErrors((current) => ({ ...current, [field]: undefined }));
    },
  });

  const fieldError = (field: InquiryField) => {
    const message = errorText(field);
    return message ? (
      <p id={`inquiry-${field}-error`} className="mt-1.5 text-[13px] font-medium text-rose-700">
        {message}
      </p>
    ) : null;
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate aria-busy={isPending} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {/* Honeypot — hidden from people and assistive technology; see lib/inquiry.ts. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="inquiry-website">Website</label>
        <input id="inquiry-website" name={INQUIRY_HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="inquiry-name" className={LABEL}>
            {copy.name}
          </label>
          <input type="text" autoComplete="name" {...fieldProps("name")} />
          {fieldError("name")}
        </div>
        <div>
          <label htmlFor="inquiry-company" className={LABEL}>
            {copy.company}
          </label>
          <input type="text" autoComplete="organization" {...fieldProps("company")} />
          {fieldError("company")}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="inquiry-email" className={LABEL}>
            {copy.email}
          </label>
          <input type="email" inputMode="email" autoComplete="email" {...fieldProps("email")} />
          {fieldError("email")}
        </div>
        <div>
          <label htmlFor="inquiry-topic" className={LABEL}>
            {copy.topic}
          </label>
          <select
            id="inquiry-topic"
            name="topic"
            defaultValue="general"
            disabled={isPending}
            className={`${CONTROL} ${CONTROL_OK}`}
          >
            {INQUIRY_TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {copy.topics[topic]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="inquiry-message" className={LABEL}>
          {copy.message}
        </label>
        <textarea rows={5} {...fieldProps("message")} className={`${fieldProps("message").className} resize-y`} />
        {fieldError("message")}
      </div>

      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-[14px] leading-[1.55] text-rose-800"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            {formError}{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={isPending}
          className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-navy-900 px-6 text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(6,17,31,0.25)] transition-colors duration-200 hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {copy.sending}
            </>
          ) : (
            <>
              {copy.submit}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>
        <p className="text-[12.5px] leading-[1.5] text-slate-500 sm:max-w-[16rem] sm:text-right">{copy.privacyNote}</p>
      </div>
    </form>
  );
}
