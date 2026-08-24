/**
 * app/admin/esg-analytics/page.tsx
 * -----------------------------------------------------------------------
 * Corporate ESG Analytics & Sustainability Dashboard. A Server Component —
 * fetches lib/services/esg-analytics.ts's summary directly (no client-side
 * fetch, no new public API route needed for a read-only, non-RBAC-gated
 * internal report) and hands it to the client component that renders the
 * charts, KPI cards, and CSV/JSON export buttons.
 *
 * force-dynamic: this is a live operational summary over the current
 * ledger, not a marketing page — it must never be served from a stale
 * build-time cache. Same reasoning as the GS1 resolver page's
 * `revalidate = 0`.
 */

import { getEsgAnalytics } from "@/lib/services/esg-analytics";
import { computePortfolioGreenAccounting } from "@/lib/services/plastic-tax-calculator";
import { EsgAnalyticsDashboard } from "@/components/dashboard/esg-analytics-dashboard";

export const dynamic = "force-dynamic";

export default async function EsgAnalyticsPage() {
  // Green Accounting & EU Plastic Tax Tracker (Sprint 3.1) — fetched
  // alongside the existing ESG summary so this page's own compact widget
  // (see EsgAnalyticsDashboard's "Green Accounting & Plastic Tax" section)
  // never disagrees with the dedicated /admin/green-accounting page, both
  // being server-computed from the same live ledger on every request.
  const [summary, greenAccounting] = await Promise.all([
    getEsgAnalytics(),
    computePortfolioGreenAccounting(),
  ]);
  return <EsgAnalyticsDashboard summary={summary} greenAccounting={greenAccounting} />;
}
