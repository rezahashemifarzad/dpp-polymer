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
import { EsgAnalyticsDashboard } from "@/components/dashboard/esg-analytics-dashboard";

export const dynamic = "force-dynamic";

export default async function EsgAnalyticsPage() {
  const summary = await getEsgAnalytics();
  return <EsgAnalyticsDashboard summary={summary} />;
}
