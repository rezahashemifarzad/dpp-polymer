/**
 * components/landing/compliance-section.tsx
 * -----------------------------------------------------------------------
 * Regulations and standards the platform's data model is built around
 * (#compliance), with what DPP-Polymer records for each. Worded as
 * "supports": the economic operator stays responsible for its declarations.
 */

import { SectionHeading } from "./section-heading";

interface Framework {
  name: string;
  reference: string;
  coverage: string;
}

const FRAMEWORKS: Framework[] = [
  {
    name: "ESPR",
    reference: "Regulation (EU) 2024/1781",
    coverage:
      "Structured passport per batch with a unique identifier, a QR data carrier resolving to a public passport, and lifecycle states (issued, revoked, superseded) that never delete history.",
  },
  {
    name: "PPWR",
    reference: "Regulation (EU) 2025/40",
    coverage: "Post-consumer and post-industrial recycled-content shares and per-batch packaging compliance declarations.",
  },
  {
    name: "REACH",
    reference: "Regulation (EC) No 1907/2006",
    coverage: "Substance of Very High Concern declarations above 0.1 % w/w, with portfolio-wide alerts.",
  },
  {
    name: "ISCC PLUS",
    reference: "Mass-balance chain of custody",
    coverage: "Chain-of-custody records and certificates reviewed by named auditors, with expiry monitoring.",
  },
  {
    name: "GS1 Digital Link",
    reference: "ISO/IEC 18975",
    coverage: "Standard web URIs per GTIN and batch, printed as QR labels for packaging and delivery documents.",
  },
  {
    name: "Product carbon footprint",
    reference: "Cradle-to-gate, kg CO₂e/kg",
    coverage: "Footprint per batch from feedstock and process inputs, calculated with exact decimal arithmetic and stored with the passport.",
  },
];

export function ComplianceSection() {
  return (
    <section aria-labelledby="compliance-title" id="compliance" className="scroll-mt-16 border-y border-slate-200 bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="compliance-title"
          eyebrow="Compliance"
          title="Built around the regulations your customers will ask about."
          lead="Each passport field maps to a requirement, so auditors and buyers get answers instead of attachments."
        />
        <div className="mt-14 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Regulations and standards supported by DPP-Polymer</caption>
            <thead className="hidden bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-header-group">
              <tr>
                <th scope="col" className="w-1/4 px-6 py-3">Framework</th>
                <th scope="col" className="w-1/4 px-6 py-3">Reference</th>
                <th scope="col" className="px-6 py-3">What DPP-Polymer records</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {FRAMEWORKS.map((f) => (
                <tr key={f.name} className="flex flex-col gap-1 px-5 py-5 md:table-row md:p-0">
                  <th scope="row" className="text-base font-semibold text-navy-900 md:px-6 md:py-5 md:align-top">
                    {f.name}
                  </th>
                  <td className="font-mono text-[13px] text-slate-500 md:px-6 md:py-5 md:align-top">{f.reference}</td>
                  <td className="pt-1 text-[15px] leading-relaxed text-slate-700 md:px-6 md:py-5 md:pt-5 md:align-top">
                    {f.coverage}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-relaxed text-slate-500">
          DPP-Polymer supports your compliance documentation. Responsibility for the accuracy of declarations remains with
          the manufacturer or economic operator placing the product on the market.
        </p>
      </div>
    </section>
  );
}
