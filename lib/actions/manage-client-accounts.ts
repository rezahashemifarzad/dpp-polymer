"use server";

/**
 * lib/actions/manage-client-accounts.ts
 * -----------------------------------------------------------------------
 * Server Actions backing the in-app Admin UI for Buyer (Client) Accounts.
 * Mirrors lib/actions/manage-auditor-accounts.ts exactly — see that
 * file's own banner for the shared rationale (no RBAC key needed in-app;
 * external callers use the ADMIN-gated REST routes under
 * app/api/admin/clients/**; actor is always "ADMIN").
 */

import {
  listClientAccounts,
  createClientAccount,
  setClientActive,
  rotateClientApiKey,
  setClientPassword,
  type ClientAccountRow,
} from "@/lib/services/manage-client-accounts";
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

export interface ListClientAccountsActionResult {
  ok: boolean;
  data?: ClientAccountRow[];
  error?: string;
}

export async function listClientAccountsAction(): Promise<ListClientAccountsActionResult> {
  await requireAdminSession();

  try {
    const data = await listClientAccounts();
    return { ok: true, data: toPlainJson(data) };
  } catch (error) {
    console.error("listClientAccountsAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to load client accounts" };
  }
}

export interface CreateClientAccountActionResult {
  ok: boolean;
  data?: { client: ClientAccountRow; rawApiKey: string };
  error?: string;
  issues?: FieldIssues;
}

export async function createClientAccountAction(input: {
  companyName: string;
  country?: string;
  contactEmail?: string;
  password?: string;
}): Promise<CreateClientAccountActionResult> {
  await requireAdminSession();

  try {
    const result = await createClientAccount(input, "ADMIN");
    if (!result.ok) {
      return { ok: false, error: result.error, issues: "issues" in result ? result.issues : undefined };
    }
    return { ok: true, data: toPlainJson(result.data) };
  } catch (error) {
    console.error("createClientAccountAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to create client account" };
  }
}

export interface SetClientActiveActionResult {
  ok: boolean;
  data?: ClientAccountRow;
  error?: string;
}

export async function setClientActiveAction(id: string, active: boolean): Promise<SetClientActiveActionResult> {
  await requireAdminSession();

  try {
    const result = await setClientActive(id, active, "ADMIN");
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: toPlainJson(result.data) };
  } catch (error) {
    console.error("setClientActiveAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to update client status" };
  }
}

export interface RotateClientApiKeyActionResult {
  ok: boolean;
  data?: { client: ClientAccountRow; rawApiKey: string };
  error?: string;
}

export async function rotateClientApiKeyAction(id: string): Promise<RotateClientApiKeyActionResult> {
  await requireAdminSession();

  try {
    const result = await rotateClientApiKey(id, "ADMIN");
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: toPlainJson(result.data) };
  } catch (error) {
    console.error("rotateClientApiKeyAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to rotate API key" };
  }
}

export interface SetClientPasswordActionResult {
  ok: boolean;
  data?: ClientAccountRow;
  error?: string;
}

export async function setClientPasswordAction(id: string, password: string): Promise<SetClientPasswordActionResult> {
  await requireAdminSession();

  try {
    const result = await setClientPassword(id, { password }, "ADMIN");
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: toPlainJson(result.data) };
  } catch (error) {
    console.error("setClientPasswordAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to set password" };
  }
}
