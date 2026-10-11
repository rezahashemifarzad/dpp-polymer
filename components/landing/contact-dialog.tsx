"use client";

/**
 * components/landing/contact-dialog.tsx
 * -----------------------------------------------------------------------
 * Modal dialog holding the B2B inquiry form (contact-form.tsx). Rendered
 * once per landing page by contact-section.tsx.
 *
 * Built on the native <dialog> element opened with showModal(), which
 * provides the accessibility behaviour for free: focus is trapped inside,
 * the rest of the page is inert, Escape closes it, and focus returns to
 * the control that opened it. Added here: closing on a backdrop click, a
 * visible close button, and focusing the first field on open. The
 * fade/scale and backdrop transitions live in app/globals.css
 * (.contact-dialog), which also locks page scrolling while it is open.
 *
 * Opening: any element marked with the data-contact-trigger attribute
 * opens the dialog (the section's button, the "Contact" links in the nav
 * and footer). Those links keep a real href to the #contact section, so
 * without JavaScript, or from a page that has no dialog (Imprint,
 * Privacy), they still lead to the Contact section — and arriving on the
 * landing page with #contact in the URL opens the dialog too.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ContactForm } from "./contact-form";
import type { SiteLocale } from "@/lib/site-config";
import type { LandingCopy } from "@/lib/i18n/landing-dictionary";

/** Attribute that turns a link or button into a dialog opener. */
export const CONTACT_TRIGGER_ATTRIBUTE = "data-contact-trigger";

interface ContactDialogProps {
  locale: SiteLocale;
  copy: LandingCopy["contact"];
}

export function ContactDialog({ locale, copy }: ContactDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Bumped after a sent inquiry so the next opening shows an empty form.
  const [formInstance, setFormInstance] = useState(0);
  const sentRef = useRef(false);

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[name="name"]')?.focus();
  }, []);

  const close = useCallback(() => dialogRef.current?.close(), []);

  useEffect(() => {
    // Capture phase on window: runs before the link's own navigation.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const trigger = (event.target as Element | null)?.closest?.(`[${CONTACT_TRIGGER_ATTRIBUTE}]`);
      if (!trigger) return;
      event.preventDefault();
      event.stopPropagation();
      // Collapse the mobile menu if the trigger sits inside it.
      trigger.closest("details")?.removeAttribute("open");
      open();
    };
    window.addEventListener("click", onClick, true);
    if (window.location.hash === "#contact") open();
    return () => window.removeEventListener("click", onClick, true);
  }, [open]);

  const handleClose = () => {
    if (sentRef.current) {
      sentRef.current = false;
      setFormInstance((n) => n + 1);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="contact-dialog-title"
      onClose={handleClose}
      onClick={(event) => {
        // The dialog element itself is only hit on the backdrop: its
        // content is fully covered by the inner wrapper.
        if (event.target === event.currentTarget) close();
      }}
      className="contact-dialog w-[calc(100%-2rem)] max-w-2xl overflow-visible rounded-2xl bg-transparent p-0 text-navy-900"
    >
      <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-navy-950/30 sm:p-9">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 id="contact-dialog-title" className="text-2xl font-semibold tracking-[-0.018em] text-navy-900">
              {copy.dialogTitle}
            </h2>
            <p className="mt-2 text-[15px] leading-[1.6] text-slate-600">{copy.dialogLead}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={copy.close}
            className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-7">
          <ContactForm
            key={formInstance}
            locale={locale}
            copy={copy.form}
            closeLabel={copy.close}
            onClose={close}
            onSentChange={(sent) => {
              sentRef.current = sent;
            }}
          />
        </div>
      </div>
    </dialog>
  );
}
