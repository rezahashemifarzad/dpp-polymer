/**
 * lib/auditor-auth.ts
 * -----------------------------------------------------------------------
 * Per-auditor personal API key authentication for the Third-Party Auditor
 * Verification Workflow.
 *
 * This is DELIBERATELY separate from lib/rbac.ts's authorize(), not a
 * variant of it. lib/rbac.ts checks a single SHARED secret per role
 * (DPP_AUDITOR_API_KEY) — fine for "was this request made by someone
 * holding an auditor-level credential," but useless for "which specific
 * person signed this." A digital sign-off is only meaningful if it is
 * attributable to one individual, so each row in the new Auditor table
 * carries its OWN key, and this module resolves a presented key back to
 * that one row.
 *
 * Still intentionally simple: header-based bearer auth, no session
 * cookies, no JWT, no expiry — a personal access token, not enterprise
 * SSO. See scripts/create-auditor.ts for how keys are provisioned, and
 * app/auditor/page.tsx for how the portal collects and stores one
 * (sessionStorage, tab-lifetime only).
 *
 * Keys are never stored in plaintext — only a SHA-256 hash
 * (Auditor.apiKeyHash) is persisted, mirroring how lib/rbac.ts's shared
 * keys live only in env vars and how PolymerPassport.recordHash never
 * stores raw claim data twice. A presented key is hashed and looked up
 * directly (O(1) unique-index lookup) rather than compared against every
 * active auditor with a timing-safe loop — a hash lookup has no
 * meaningful early-exit timing signal to protect against the way a
 * byte-by-byte secret comparison does.
 */

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Auditor } from "@prisma/client";

const AUDITOR_KEY_HEADER = "x-dpp-auditor-key";

/**
 * SHA-256 hex digest of a raw auditor key. Exported so
 * scripts/create-auditor.ts can compute the same hash at provisioning time
 * without duplicating the algorithm choice.
 */
export function hashAuditorKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

/**
 * Resolves the request's `x-dpp-auditor-key` header to the Auditor it
 * belongs to. Returns null (never throws) for: missing header, unknown
 * key, or a key belonging to a deactivated (active: false) Auditor — a
 * soft-revoked auditor is authenticated exactly like a nonexistent one.
 */
export async function authorizeAuditor(req: Request): Promise<Auditor | null> {
  const presentedKey = req.headers.get(AUDITOR_KEY_HEADER);
  if (!presentedKey || !presentedKey.trim()) return null;

  const apiKeyHash = hashAuditorKey(presentedKey.trim());
  const auditor = await prisma.auditor.findUnique({ where: { apiKeyHash } });
  if (!auditor || !auditor.active) return null;

  return auditor;
}

export function auditorUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: `Unauthorized: a valid ${AUDITOR_KEY_HEADER} header for an active auditor is required`,
    },
    { status: 401 }
  );
}
