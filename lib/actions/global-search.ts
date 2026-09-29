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
// Security (2026-09-29): admin-only Server Action. A Server Action is a
// public POST endpoint in its own right, so being mounted only under
// /admin is not a guard. Every export below re-verifies an active ADMIN
// session first (outside any try/catch, so requireAdminSession()'s
// redirect to /login propagates instead of being swallowed).
import { requireAdminSession } from "@/lib/session-auth";

export interface GlobalSearchActionResult {
  ok: boolean;
  data?: GlobalSearchResult;
  error?: string;
}

export async function globalSearchAction(filters: GlobalSearchFilters): Promise<GlobalSearchActionResult> {
  await requireAdminSession();

  try {
    const data = await searchGlobal(filters);
    return { ok: true, data };
  } catch (error) {
    console.error("globalSearchAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Search failed" };
  }
}
