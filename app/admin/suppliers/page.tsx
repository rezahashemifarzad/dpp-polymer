/**
 * app/admin/suppliers/page.tsx
 * -----------------------------------------------------------------------
 * Supplier Performance & Compliance Ranking Dashboard (Phase 7 - Step 2).
 * A Server Component — fetches lib/services/supplier-analytics.ts's
 * summary directly (no client-side fetch, no RBAC key needed for this
 * in-app render — same pattern as app/admin/esg-analytics/page.tsx) and
 * hands it to the client component that renders the ranking table,
 * scorecards, and compliance breakdown.
 *
 * force-dynamic: this is a live operational ranking over the current
 * ledger, not a marketing page — it must never be served from a stale
 * build-time cache. Same reasoning as every other /admin/* report page.
 */

import { getSupplierAnalytics } from "@/lib/services/supplier-analytics";
import { SupplierRankingDashboard } from "@/components/dashboard/supplier-ranking-dashboard";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const summary = await getSupplierAnalytics();
  return <SupplierRankingDashboard summary={summary} />;
}
