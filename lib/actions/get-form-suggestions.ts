"use server";

/**
 * lib/actions/get-form-suggestions.ts
 * -----------------------------------------------------------------------
 * Server Action backing the autocomplete suggestions on the "Issue New
 * Polymer Passport" form (Grade, Manufacturer) and the Batch Details
 * modal's "Add Chain-of-Custody Tier" form (Participant Name). Same
 * dual-path reasoning as lib/actions/global-search.ts: this runs
 * server-side and needs no RBAC key, so it's what the in-app forms call
 * directly; GET /api/form-suggestions is the public REST entry point for
 * external callers.
 */

import { getFormSuggestions, type FormSuggestions } from "@/lib/services/form-suggestions";
import { requireAdminSession } from "@/lib/session-auth";

export interface GetFormSuggestionsActionResult {
  ok: boolean;
  data?: FormSuggestions;
  error?: string;
}

export async function getFormSuggestionsAction(): Promise<GetFormSuggestionsActionResult> {
  // Access-control audit (2026-09-30): admin-only mutation/read. Called
  // OUTSIDE the try/catch so Next.js's redirect to /login propagates.
  await requireAdminSession();

  try {
    const data = await getFormSuggestions();
    return { ok: true, data };
  } catch (error) {
    console.error("getFormSuggestionsAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to load suggestions" };
  }
}
