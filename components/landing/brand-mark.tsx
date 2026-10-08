/**
 * components/landing/brand-mark.tsx
 * -----------------------------------------------------------------------
 * DPP-Polymer wordmark with a small monomer-chain glyph (three linked
 * units). Pure SVG, inherits currentColor for the text.
 */

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className = "" }: BrandMarkProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 28 28" aria-hidden="true" className="h-7 w-7 shrink-0">
        <rect x="0.5" y="0.5" width="27" height="27" rx="6" className="fill-navy-800 stroke-white/15" />
        <path d="M7 18.5 L14 9.5 L21 18.5" fill="none" strokeWidth="1.6" className="stroke-slate-400" />
        <circle cx="7" cy="18.5" r="2.6" className="fill-white" />
        <circle cx="14" cy="9.5" r="2.6" className="fill-teal-400" />
        <circle cx="21" cy="18.5" r="2.6" className="fill-white" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">
        DPP<span className="text-slate-400">-</span>Polymer
      </span>
    </span>
  );
}
