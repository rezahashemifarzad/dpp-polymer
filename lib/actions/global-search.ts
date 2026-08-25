"use server";

/**
 * lib/actions/global-search.ts
 * -----------------------------------------------------------------------
 * Server Action backing the admin Global Search command palette and the
 * dedicated /admin/search page's own interactive re-queries. Same
 * dual-path reasoning as every other action in lib/actions/: this runs
 * entirely server-side and never needs an RBAC key, so it's what the
 * in-app, search-as-you-type UI calls directly (a plain async function
 * call, not a fetch — no network round trip to reason about auth for);
 * GET /api/admin/search is the ADMIN-gated entry point for external
 * callers instead.
 */

import { searchGlobal, type GlobalSearchFilters, type GlobalSearchResult } from "@/lib/services/global-search";

export interface GlobalSearchActionResult {
  ok: boolean;
  data?: GlobalSearchResult;
  error?: string;
}

export async function globalSearchAction(filters: GlobalSearchFilters): Promise<GlobalSearchActionResult> {
  try {
    const data = await searchGlobal(filters);
    return { ok: true, data };
  } catch (error) {
    console.error("globalSearchAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Search failed" };
  }
}
