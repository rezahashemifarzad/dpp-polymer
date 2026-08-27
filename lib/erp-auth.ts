/**
 * lib/erp-auth.ts
 * -----------------------------------------------------------------------
 * Per-manufacturer API key authentication for the ERP / Automated Batch
 * Intake Integration (SAP, Microsoft Dynamics, or any system that can send
 * an HTTPS POST).
 *
 * Structurally identical to lib/auditor-auth.ts and lib/client-auth.ts —
 * SHA-256-hashed bearer key, resolved via a unique-index lookup, soft-
 * revocable — and deliberately a third duplicate of that same small
 * pattern rather than a shared abstraction, for the exact reason
 * lib/client-auth.ts's own file banner already gives: three structurally
 * identical but semantically distinct guards (different table, different
 * header, different failure consequence) is exactly the trigger point
 * client-auth.ts named for finally extracting a shared helper. That
 * extraction is a good follow-up, but out of scope for this feature on
 * its own — it isn't required to ship a correct, additive integration,
 * and touching the two already-working modules to do it is more risk than
 * this task needs to take on.
 *
 * This is deliberately NOT lib/rbac.ts's shared DPP_MANUFACTURER_API_KEY.
 * That key authenticates "someone holding manufacturer-level credentials"
 * for the legacy POST /api/passports route, and (per that route's own
 * TODO(auth) comment) still trusts whatever manufacturerId the request
 * body claims. An ERP integration needs the stronger guarantee this module
 * provides: which SPECIFIC manufacturer is this, so app/api/erp/passports/
 * route.ts can force manufacturerId server-side and an ERP can never push
 * a batch under another manufacturer's identity.
 *
 * Presented via the `x-dpp-manufacturer-key` header. See
 * scripts/set-manufacturer-key.ts for provisioning.
 */

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Manufacturer } from "@prisma/client";

const MANUFACTURER_KEY_HEADER = "x-dpp-manufacturer-key";

/**
 * SHA-256 hex digest of a raw manufacturer ERP key. Exported so
 * scripts/set-manufacturer-key.ts can compute the same hash at
 * provisioning time without duplicating the algorithm choice.
 */
export function hashManufacturerKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

/**
 * Resolves the request's `x-dpp-manufacturer-key` header to the
 * Manufacturer it belongs to. Returns null (never throws) for: missing
 * header, unknown key, a key belonging to a soft-revoked
 * (apiKeyActive: false) manufacturer, or a manufacturer with no key
 * provisioned at all (apiKeyHash: null never matches a findUnique lookup).
 */
export async function authorizeManufacturer(req: Request): Promise<Manufacturer | null> {
  const presentedKey = req.headers.get(MANUFACTURER_KEY_HEADER);
  if (!presentedKey || !presentedKey.trim()) return null;

  const apiKeyHash = hashManufacturerKey(presentedKey.trim());
  const manufacturer = await prisma.manufacturer.findUnique({ where: { apiKeyHash } });
  if (!manufacturer || !manufacturer.apiKeyActive) return null;

  return manufacturer;
}

export function manufacturerUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: `Unauthorized: a valid ${MANUFACTURER_KEY_HEADER} header for an active manufacturer ERP integration is required`,
    },
    { status: 401 }
  );
}
