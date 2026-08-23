/**
 * lib/client-auth.ts
 * -----------------------------------------------------------------------
 * Per-buyer-company API key authentication for the B2B Client Portal &
 * Buyer API Access feature.
 *
 * Structurally identical to lib/auditor-auth.ts (personal/company bearer
 * key, SHA-256-hashed at rest, resolved via a unique-index lookup) —
 * deliberately duplicated rather than generalized into one shared "actor
 * auth" module. The two guard different tables (Auditor vs Client) with
 * different header names and different consequences on failure, and this
 * app has already chosen small, obviously-correct duplication over a
 * premature shared abstraction in a few other places (see
 * scripts/create-auditor.ts's own note on the same trade-off). If a third
 * actor type shows up needing the same pattern, that's the trigger to
 * extract a shared helper — not before.
 *
 * Presented via the `x-dpp-client-key` header. See scripts/create-client.ts
 * for provisioning and app/client-portal/page.tsx for how the portal
 * collects and stores one (sessionStorage, tab-lifetime only — same
 * rationale as the Auditor Portal).
 */

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Client } from "@prisma/client";

const CLIENT_KEY_HEADER = "x-dpp-client-key";

/** SHA-256 hex digest of a raw client key. Mirrors hashAuditorKey exactly. */
export function hashClientKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

/**
 * Resolves the request's `x-dpp-client-key` header to the Client (buyer
 * company) it belongs to. Returns null (never throws) for: missing
 * header, unknown key, or a key belonging to a deactivated
 * (active: false) Client.
 */
export async function authorizeClient(req: Request): Promise<Client | null> {
  const presentedKey = req.headers.get(CLIENT_KEY_HEADER);
  if (!presentedKey || !presentedKey.trim()) return null;

  const apiKeyHash = hashClientKey(presentedKey.trim());
  const client = await prisma.client.findUnique({ where: { apiKeyHash } });
  if (!client || !client.active) return null;

  return client;
}

export function clientUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: `Unauthorized: a valid ${CLIENT_KEY_HEADER} header for an active client account is required`,
    },
    { status: 401 }
  );
}
