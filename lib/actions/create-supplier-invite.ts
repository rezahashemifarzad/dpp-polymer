"use server";

/**
 * lib/actions/create-supplier-invite.ts
 * -----------------------------------------------------------------------
 * Server Action backing the in-app admin "Invite Supplier" flow (see
 * components/dashboard/supplier-review-panel.tsx). Runs entirely
 * server-side — same "no RBAC key needed, the trust boundary is that this
 * code only runs because a component in THIS app invoked it" reasoning as
 * lib/actions/create-passport.ts — external callers instead use POST
 * /api/admin/supplier-invites (ADMIN-gated).
 */

import { createSupplierInvite, type CreateSupplierInviteInput } from "@/lib/services/supplier-submission";
// Security (2026-09-29): admin-only Server Action. A Server Action is a
// public POST endpoint in its own right, so being mounted only under
// /admin is not a guard. Every export below re-verifies an active ADMIN
// session first (outside any try/catch, so requireAdminSession()'s
// redirect to /login propagates instead of being swallowed).
import { requireAdminSession } from "@/lib/session-auth";

export interface CreateSupplierInviteActionResult {
  ok: boolean;
  data?: { inviteId: string; companyName: string; rawToken: string; submitUrl: string };
  error?: string;
}

export async function createSupplierInviteAction(
  input: CreateSupplierInviteInput
): Promise<CreateSupplierInviteActionResult> {
  await requireAdminSession();

  try {
    const result = await createSupplierInvite(input, "ADMIN");
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return {
      ok: true,
      data: {
        inviteId: result.data.invite.id,
        companyName: result.data.invite.companyName,
        rawToken: result.data.rawToken,
        submitUrl: result.data.submitUrl,
      },
    };
  } catch (error) {
    console.error("createSupplierInviteAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to create supplier invite" };
  }
}
