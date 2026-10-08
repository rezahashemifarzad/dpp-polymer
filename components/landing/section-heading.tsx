/**
 * components/landing/section-heading.tsx
 * -----------------------------------------------------------------------
 * Eyebrow + title + lead paragraph used by every content section, so the
 * type scale stays identical across the site.
 */

interface SectionHeadingProps {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  tone?: "light" | "dark";
}

export function SectionHeading({ id, eyebrow, title, lead, tone = "light" }: SectionHeadingProps) {
  const dark = tone === "dark";
  return (
    <div className="max-w-2xl">
      <p
        className={`flex items-center gap-2.5 text-[11.5px] font-semibold uppercase tracking-[0.16em] ${
          dark ? "text-slate-400" : "text-slate-500"
        }`}
      >
        <span className={`h-px w-6 ${dark ? "bg-teal-400" : "bg-teal-600"}`} aria-hidden="true" />
        {eyebrow}
      </p>
      <h2
        id={id}
        className={`mt-4 text-[2rem] font-semibold leading-[1.15] tracking-[-0.022em] text-balance sm:text-[2.5rem] ${
          dark ? "text-white" : "text-navy-900"
        }`}
      >
        {title}
      </h2>
      <p className={`mt-5 text-[17px] leading-[1.7] text-pretty ${dark ? "text-slate-300" : "text-slate-600"}`}>{lead}</p>
    </div>
  );
}
