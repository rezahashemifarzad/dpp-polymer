/**
 * components/landing/legal-page.tsx
 * -----------------------------------------------------------------------
 * Shared shell for the corporate site's legal pages (Imprint, Privacy):
 * same nav and footer as the landing page, readable single-column body.
 */

import type { ReactNode } from "react";
import { LandingNav } from "./landing-nav";
import { LandingFooter } from "./landing-footer";

interface LegalPageProps {
  title: string;
  updated?: string;
  children: ReactNode;
}

export function LegalPage({ title, updated, children }: LegalPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-navy-900">
      <LandingNav />
      <main id="main" className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          {updated && <p className="mt-3 text-sm text-slate-500">Last updated: {updated}</p>}
          <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-slate-700 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-navy-900 [&_h2+*]:mt-3 [&_a]:font-medium [&_a]:text-teal-800 [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_p+p]:mt-3">
            {children}
          </div>
        </article>
      </main>
      <LandingFooter />
    </div>
  );
}
