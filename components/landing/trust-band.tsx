/**
 * components/landing/trust-band.tsx
 * -----------------------------------------------------------------------
 * Compliance and security badges directly under the hero: ESPR readiness,
 * PPWR recycled content, Frankfurt hosting, server-side RBAC and SHA-256
 * sealing. Every badge states a fact about the platform as built; none is
 * a third-party certification.
 */

import type { LucideIcon } from "lucide-react";
import { Lock, MapPin, Recycle, Scale, ScrollText } from "lucide-react";
import type { LandingCopy } from "@/lib/i18n/landing-dictionary";

/** Icons in the same order as LandingCopy["trust"]["items"]. */
const ICONS: LucideIcon[] = [Scale, Recycle, MapPin, Lock, ScrollText];

interface TrustBandProps {
  copy: LandingCopy["trust"];
}

export function TrustBand({ copy }: TrustBandProps) {
  return (
    <div className="border-t border-white/[0.08] bg-navy-950/60">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 lg:px-8">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 lg:text-left">
          {copy.label}
        </p>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {copy.items.map((item, i) => {
            const Icon = ICONS[i] ?? Scale;
            return (
              <li
                key={item.title}
                className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-3 transition-colors duration-200 hover:border-white/[0.16] hover:bg-white/[0.05] motion-reduce:transition-none"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-teal-300">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold leading-snug text-white">{item.title}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-400">{item.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
