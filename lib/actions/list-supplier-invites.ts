"use server";

/**
 * lib/actions/list-supplier-invites.ts
 * -----------------------------------------------------------------------
 * Server Action backing the admin "Manage Supplier Invites" list — same
 * PII rationale as lib/actions/list-supplier-submissions.ts for why this
 * is a Server Action, not a public fetch().
 */

import { listSupplierInvites, revokeSupplierInvite } from "@/lib/services/supplier-submission";

function toPlainJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

export interface ListSupplierInvitesActionResult {
  ok: boolean;
  data?: unknown[];
  error?: string;
}

export async function listSupplierInvitesAction(): Promise<ListSupplierInvitesActionResult> {
  try {
    const invites = await listSupplierInvites();
    return { ok: true, data: toPlainJson(invites) as unknown[] };
  } catch (error) {
    console.error("listSupplierInvitesAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to load supplier invites" };
  }
}

export interface RevokeSupplierInviteActionResult {
  ok: boolean;
  error?: string;
}

export async function revokeSupplierInviteAction(inviteId: string): Promise<RevokeSupplierInviteActionResult> {
  try {
    const result = await revokeSupplierInvite(inviteId);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true };
  } catch (error) {
    console.error("revokeSupplierInviteAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to revoke supplier invite" };
  }
}
