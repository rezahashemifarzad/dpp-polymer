/**
 * components/landing/cta-link.tsx
 * -----------------------------------------------------------------------
 * The corporate site's only button styles. Four variants, chosen by the
 * surface they sit on, so every CTA keeps high contrast:
 *
 *   on navy:   "solid-light" (white fill)   | "outline-light"
 *   on white:  "solid-dark"  (navy fill)    | "outline-dark"
 *
 * Interaction: 1px lift and a soft shadow on hover, pressed state on
 * active, a 2px offset focus ring for keyboard users, and a trailing arrow
 * that nudges right. All motion is disabled under prefers-reduced-motion.
 *
 * Internal routes render a Next <Link>; mailto:/external URLs a plain <a>.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

type Variant = "solid-light" | "outline-light" | "solid-dark" | "outline-dark";
type Size = "sm" | "md" | "lg";

const BASE =
  "group inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap select-none " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out " +
  "hover:-translate-y-px active:translate-y-0 active:shadow-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0";

const VARIANTS: Record<Variant, string> = {
  "solid-light":
    "bg-white text-navy-950 shadow-[0_1px_2px_rgba(0,0,0,0.2)] hover:bg-slate-100 hover:shadow-[0_6px_20px_-6px_rgba(255,255,255,0.35)] focus-visible:outline-white",
  "outline-light":
    "border border-white/20 bg-white/[0.03] text-white hover:border-white/40 hover:bg-white/[0.08] focus-visible:outline-white",
  "solid-dark":
    "bg-navy-900 text-white shadow-[0_1px_2px_rgba(6,17,31,0.25)] hover:bg-navy-800 hover:shadow-[0_8px_24px_-8px_rgba(6,17,31,0.55)] focus-visible:outline-navy-700",
  "outline-dark":
    "border border-slate-300 bg-white text-navy-900 hover:border-slate-400 hover:bg-slate-50 hover:shadow-[0_6px_16px_-8px_rgba(6,17,31,0.25)] focus-visible:outline-navy-700",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

interface CtaLinkProps {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  /** Show a trailing arrow that nudges on hover. */
  arrow?: boolean;
  className?: string;
}

export function CtaLink({ href, children, variant = "solid-dark", size = "md", arrow = false, className = "" }: CtaLinkProps) {
  const classes = `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`.trim();
  const content = (
    <>
      {children}
      {arrow && (
        <ArrowRight
          className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
          aria-hidden="true"
        />
      )}
    </>
  );
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <a href={href} className={classes}>
      {content}
    </a>
  );
}
