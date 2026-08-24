/**
 * lib/supplier-invite-auth.ts
 * -----------------------------------------------------------------------
 * Token-based authentication for the Supplier Onboarding Portal
 * (/supplier/submit/[token]).
 *
 * Structurally related to lib/auditor-auth.ts and lib/client-auth.ts —
 * same "hash at rest, resolve via a unique-index lookup" principle as
 * Auditor.apiKeyHash/Client.apiKeyHash — but deliberately its own module,
 * not a third copy squeezed into the same shape: those two resolve a
 * bearer key from a request HEADER for an authenticated in-app portal
 * session. A supplier invite instead resolves a raw token embedded
 * directly in a public URL PATH segment (/supplier/submit/{token}), since
 * the credential here is handed to someone entirely outside the system
 * (often by email) rather than configured into a client that can set
 * custom headers. This app has already chosen small, obviously-correct
 * duplication over a premature shared "actor auth" abstraction in a few
 * other places (see lib/client-auth.ts's own note on the same trade-off)
 * — if a fourth actor type shows up needing the same pattern, that's the
 * trigger to extract a shared helper, not before.
 *
 * The raw token is shown to the admin exactly once, at invite-creation
 * time (see lib/services/supplier-submission.ts's createSupplierInvite),
 * and is never recoverable from the database afterward — only its
 * SHA-256 hash (SupplierInvite.tokenHash) is persisted.
 */

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { SupplierInvite } from "@prisma/client";

/** SHA-256 hex digest of a raw supplier invite token. Mirrors hashAuditorKey/hashClientKey exactly. */
export function hashSupplierToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/**
 * Resolves a raw invite token (the `[token]` route param) to the
 * SupplierInvite it belongs to. Returns null (never throws) for: empty
 * token, unknown token, a deactivated (active: false) invite, or an
 * invite past its optional expiresAt — every one of those cases should
 * read identically to the supplier ("this link isn't valid"), never leak
 * *why* a token doesn't resolve.
 */
export async function resolveSupplierInvite(rawToken: string): Promise<SupplierInvite | null> {
  if (!rawToken || !rawToken.trim()) return null;

  const tokenHash = hashSupplierToken(rawToken.trim());
  const invite = await prisma.supplierInvite.findUnique({ where: { tokenHash } });
  if (!invite || !invite.active) return null;
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return null;

  return invite;
}

export function supplierInviteNotFoundResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: "This supplier submission link is invalid, has been revoked, or has expired.",
    },
    { status: 404 }
  );
}
