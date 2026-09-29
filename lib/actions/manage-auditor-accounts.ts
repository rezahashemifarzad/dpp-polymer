"use server";

/**
 * lib/actions/manage-auditor-accounts.ts
 * -----------------------------------------------------------------------
 * Server Actions backing the in-app Admin UI for Auditor Accounts (see
 * components/dashboard/access-control/access-control-dashboard.tsx). Same
 * "no RBAC key needed, the trust boundary is that this code only runs
 * because a component in THIS app invoked it" reasoning as every other
 * in-app admin Server Action (e.g. lib/actions/create-supplier-invite.ts)
 * — external callers instead use the ADMIN-gated REST routes under
 * app/api/admin/auditors/**. actor is always "ADMIN", same convention as
 * every other in-app Server Action in this codebase.
 */

import {
  listAuditorAccounts,
  createAuditorAccount,
  setAuditorActive,
  rotateAuditorApiKey,
  setAuditorPassword,
  type AuditorAccountRow,
} from "@/lib/services/manage-auditor-accounts";
// Security (2026-09-29): admin-only Server Action. A Server Action is a
// public POST endpoint in its own right, so being mounted only under
// /admin is not a guard. Every export below re-verifies an active ADMIN
// session first (outside any try/catch, so requireAdminSession()'s
// redirect to /login propagates instead of being swallowed).
import { requireAdminSession } from "@/lib/session-auth";

function toPlainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type FieldIssues = { formErrors: string[]; fieldErrors: Record<string, string[]> };

export interface ListAuditorAccountsActionResult {
  ok: boolean;
  data?: AuditorAccountRow[];
  error?: string;
}

export async function listAuditorAccountsAction(): Promise<ListAuditorAccountsActionResult> {
  await requireAdminSession();

  try {
    const data = await listAuditorAccounts();
    return { ok: true, data: toPlainJson(data) };
  } catch (error) {
    console.error("listAuditorAccountsAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to load auditor accounts" };
  }
}

export interface CreateAuditorAccountActionResult {
  ok: boolean;
  data?: { auditor: AuditorAccountRow; rawApiKey: string };
  error?: string;
  issues?: FieldIssues;
}

export async function createAuditorAccountAction(input: {
  name: string;
  organization: string;
  email?: string;
  password?: string;
}): Promise<CreateAuditorAccountActionResult> {
  await requireAdminSession();

  try {
    const result = await createAuditorAccount(input, "ADMIN");
    if (!result.ok) {
      return { ok: false, error: result.error, issues: "issues" in result ? result.issues : undefined };
    }
    return { ok: true, data: toPlainJson(result.data) };
  } catch (error) {
    console.error("createAuditorAccountAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to create auditor account" };
  }
}

export interface SetAuditorActiveActionResult {
  ok: boolean;
  data?: AuditorAccountRow;
  error?: string;
}

export async function setAuditorActiveAction(id: string, active: boolean): Promise<SetAuditorActiveActionResult> {
  await requireAdminSession();

  try {
    const result = await setAuditorActive(id, active, "ADMIN");
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: toPlainJson(result.data) };
  } catch (error) {
    console.error("setAuditorActiveAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to update auditor status" };
  }
}

export interface RotateAuditorApiKeyActionResult {
  ok: boolean;
  data?: { auditor: AuditorAccountRow; rawApiKey: string };
  error?: string;
}

export async function rotateAuditorApiKeyAction(id: string): Promise<RotateAuditorApiKeyActionResult> {
  await requireAdminSession();

  try {
    const result = await rotateAuditorApiKey(id, "ADMIN");
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: toPlainJson(result.data) };
  } catch (error) {
    console.error("rotateAuditorApiKeyAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to rotate API key" };
  }
}

export interface SetAuditorPasswordActionResult {
  ok: boolean;
  data?: AuditorAccountRow;
  error?: string;
}

export async function setAuditorPasswordAction(id: string, password: string): Promise<SetAuditorPasswordActionResult> {
  await requireAdminSession();

  try {
    const result = await setAuditorPassword(id, { password }, "ADMIN");
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: toPlainJson(result.data) };
  } catch (error) {
    console.error("setAuditorPasswordAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to set password" };
  }
}
