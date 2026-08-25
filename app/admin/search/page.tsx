/**
 * app/admin/search/page.tsx
 * -----------------------------------------------------------------------
 * Global Search & Multi-Layer Filtering Suite (Phase 7 - Step 3) — the
 * dedicated full-page counterpart to the command palette
 * (components/dashboard/global-search-palette.tsx). A Server Component —
 * runs the initial search (from the optional `?q=` deep link the palette's
 * own "Advanced Search & Filters" link produces) directly against
 * lib/services/global-search.ts server-side, same pattern as every other
 * /admin/* report page (app/admin/esg-analytics/page.tsx,
 * app/admin/suppliers/page.tsx) — then hands the result to the client
 * dashboard for interactive filtering.
 *
 * force-dynamic: a live query over the current ledger, never a stale
 * build-time cache. Same reasoning as every other /admin/* report page.
 */

import { Suspense } from "react";
import { searchGlobal } from "@/lib/services/global-search";
import { GlobalSearchDashboard } from "@/components/dashboard/global-search-dashboard";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function GlobalSearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const initialResult = await searchGlobal({ query: q, limitPerType: 20 });

  return (
    <Suspense fallback={null}>
      <GlobalSearchDashboard initialResult={initialResult} initialQuery={q ?? ""} />
    </Suspense>
  );
}
