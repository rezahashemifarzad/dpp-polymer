/**
 * app/admin/green-accounting/page.tsx
 * -----------------------------------------------------------------------
 * Green Accounting & EU Plastic Tax Tracker — dedicated admin page. A
 * Server Component — fetches lib/services/plastic-tax-calculator.ts's
 * portfolio summary, the current tax-parameter list, and (Sprint 3.3)
 * lib/services/green-tax-trend-forecast.ts's quarterly/yearly trend +
 * forecast, all directly server-side (no client-side fetch on initial
 * load, mirroring app/admin/esg-analytics/page.tsx's own pattern), and
 * hands all three to the client component.
 *
 * force-dynamic: this is a live financial summary over the current
 * ledger, not a marketing page — it must never be served from a stale
 * build-time cache. Same reasoning as app/admin/esg-analytics/page.tsx.
 */

import { computePortfolioGreenAccounting, listTaxParameters } from "@/lib/services/plastic-tax-calculator";
import { computeGreenTaxTrendForecast } from "@/lib/services/green-tax-trend-forecast";
import { GreenAccountingDashboard } from "@/components/dashboard/green-accounting-dashboard";

export const dynamic = "force-dynamic";

export default async function GreenAccountingPage() {
  const [summary, taxParameters, trendForecast] = await Promise.all([
    computePortfolioGreenAccounting(),
    listTaxParameters(),
    computeGreenTaxTrendForecast(),
  ]);
  return (
    <GreenAccountingDashboard summary={summary} taxParameters={taxParameters} trendForecast={trendForecast} />
  );
}
