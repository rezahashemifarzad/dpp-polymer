/**
 * components/landing/value-pillars.tsx
 * -----------------------------------------------------------------------
 * The three value pillars (#features): ESPR/PPWR compliance, role-based
 * access control, and supply-chain traceability. Each point maps to a
 * feature that exists in the platform today.
 */

import type { LucideIcon } from "lucide-react";
import { Network, Scale, ShieldCheck } from "lucide-react";
import { SectionHeading } from "./section-heading";

interface Pillar {
  icon: LucideIcon;
  title: string;
  summary: string;
  points: string[];
}

const PILLARS: Pillar[] = [
  {
    icon: Scale,
    title: "ESPR & PPWR compliance",
    summary: "One structured passport per batch, ready for the data requirements of the EU Digital Product Passport.",
    points: [
      "Recycled-content (PCR/PIR) and PPWR declarations",
      "REACH SVHC declarations with automatic alerts",
      "Compliance reports and ledger exports (PDF, Excel)",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Secure role-based access",
    summary: "Every role sees exactly what it needs: administrators, auditors, customers, suppliers and the public.",
    points: [
      "Authorization enforced on the server for every request",
      "Customers see only their own purchased batches",
      "Auditors verify records without admin rights",
    ],
  },
  {
    icon: Network,
    title: "Supply-chain traceability",
    summary: "Follow material from feedstock to finished compound, with every handover documented.",
    points: [
      "ISCC PLUS chain-of-custody records, auditor-verified",
      "Batch genealogy linking parent and child batches",
      "Supplier onboarding via secure single-use links",
    ],
  },
];

export function ValuePillars() {
  return (
    <section aria-labelledby="features-title" id="features" className="scroll-mt-16 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="features-title"
          eyebrow="Platform"
          title="Compliance, access control and traceability in one system."
          lead="Replace spreadsheets, PDFs and email chains with a single verified record that travels with every batch."
        />
        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, summary, points }) => (
            <article key={title} className="flex flex-col bg-white p-7 sm:p-8">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-900 text-teal-400">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-6 text-lg font-semibold text-navy-900">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{summary}</p>
              <ul className="mt-6 space-y-3 border-t border-slate-100 pt-6">
                {points.map((point) => (
                  <li key={point} className="flex gap-3 text-sm leading-snug text-slate-700">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-teal-600" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
