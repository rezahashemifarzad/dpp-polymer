/**
 * components/landing/section-heading.tsx
 * -----------------------------------------------------------------------
 * Eyebrow + title + lead paragraph used by every content section.
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
      <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${dark ? "text-teal-400" : "text-teal-700"}`}>
        {eyebrow}
      </p>
      <h2
        id={id}
        className={`mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl ${dark ? "text-white" : "text-navy-900"}`}
      >
        {title}
      </h2>
      <p className={`mt-4 text-lg leading-relaxed ${dark ? "text-slate-300" : "text-slate-600"}`}>{lead}</p>
    </div>
  );
}
