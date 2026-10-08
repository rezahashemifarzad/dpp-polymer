/**
 * components/landing/security-section.tsx
 * -----------------------------------------------------------------------
 * Security and data integrity (#security): the role model, plus the three
 * integrity guarantees the platform enforces in code.
 */

import type { LucideIcon } from "lucide-react";
import { Building2, Database, Eye, KeyRound, Lock, ScrollText, ShieldCheck, Truck } from "lucide-react";
import { SectionHeading } from "./section-heading";

interface Role {
  icon: LucideIcon;
  name: string;
  access: string;
}

const ROLES: Role[] = [
  { icon: ShieldCheck, name: "Administrator", access: "Creates and manages passports, accounts and settings." },
  { icon: KeyRound, name: "Auditor", access: "Verifies certificates and custody records; reads audit trails." },
  { icon: Building2, name: "Customer", access: "Sees only the batches it has purchased." },
  { icon: Truck, name: "Supplier", access: "Submits batch data through a single-use invitation for review." },
  { icon: Eye, name: "Public", access: "Scans the QR code and reads the issued passport only." },
];

interface Guarantee {
  icon: LucideIcon;
  title: string;
  body: string;
}

const GUARANTEES: Guarantee[] = [
  {
    icon: Lock,
    title: "Deny by default",
    body: "Every API route and server action checks the caller's session or key on the server. A release that adds an unprotected endpoint fails its build.",
  },
  {
    icon: ScrollText,
    title: "Tamper-evident records",
    body: "Passports are sealed with SHA-256 and every change is written to a hash-linked audit log that can be re-verified at any time. Records are revoked or superseded, never deleted.",
  },
  {
    icon: Database,
    title: "EU data residency",
    body: "Passport data is stored in a managed PostgreSQL database in Frankfurt, Germany, and served only over encrypted connections.",
  },
];

export function SecuritySection() {
  return (
    <section aria-labelledby="security-title" id="security" className="scroll-mt-16 bg-navy-900 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="security-title"
          tone="dark"
          eyebrow="Security"
          title="Least privilege for every participant in the chain."
          lead="Supply-chain data is commercially sensitive. Access is scoped by role and enforced on the server, not just hidden in the interface."
        />

        <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Roles</h3>
            <ul className="mt-5 divide-y divide-white/10 rounded-xl border border-white/10 bg-navy-950/40">
              {ROLES.map(({ icon: Icon, name, access }) => (
                <li key={name} className="flex items-start gap-4 px-5 py-4">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" aria-hidden="true" />
                  <div>
                    <p className="text-[15px] font-semibold">{name}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-300">{access}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Integrity</h3>
            <div className="mt-5 space-y-8">
              {GUARANTEES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5">
                    <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-lg font-semibold">{title}</p>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-slate-300">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
