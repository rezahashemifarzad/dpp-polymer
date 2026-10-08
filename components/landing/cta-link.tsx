/**
 * components/landing/cta-link.tsx
 * -----------------------------------------------------------------------
 * The corporate site's only button styles. Internal routes render a Next
 * <Link> (client-side transition into the platform); mailto:/external URLs
 * render a plain <a>.
 */

import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "inverse" | "ghost-dark";
type Size = "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2";

const VARIANTS: Record<Variant, string> = {
  // Accent fill — the single high-contrast action on dark or light surfaces.
  primary: "bg-teal-500 text-navy-950 hover:bg-teal-400 focus-visible:outline-teal-400",
  // Outlined, for light surfaces.
  secondary:
    "border border-slate-300 bg-white text-navy-900 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-navy-700",
  // Solid navy, for light surfaces.
  inverse: "bg-navy-900 text-white hover:bg-navy-800 focus-visible:outline-navy-700",
  // Outlined, for navy surfaces.
  "ghost-dark":
    "border border-white/25 text-white hover:border-white/50 hover:bg-white/5 focus-visible:outline-white",
};

const SIZES: Record<Size, string> = {
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

interface CtaLinkProps {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}

export function CtaLink({ href, children, variant = "primary", size = "md", className = "" }: CtaLinkProps) {
  const classes = `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`.trim();
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={classes}>
      {children}
    </a>
  );
}
