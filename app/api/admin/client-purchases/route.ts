/**
 * app/api/admin/client-purchases/route.ts
 * -----------------------------------------------------------------------
 * POST /api/admin/client-purchases — records that a batch was
 * sold/allocated to a buyer (Client), making it visible in that buyer's
 * B2B Client Portal and Buyer API. Gated to ADMIN via lib/rbac.ts's
 * shared role key — the same interim RBAC every other admin-only mutation
 * in this app uses (see app/api/passports/[batchId]/route.ts's PATCH).
 *
 * This is intentionally the ONLY write surface for allocations besides
 * the equivalent CLI (scripts/allocate-passport-to-client.ts) — both call
 * the same lib/services/allocate-passport-to-client.ts, so there is one
 * implementation of "what does recording a purchase actually do."
 *
 * There is no dedicated admin UI screen for this yet (out of scope for
 * this pass) — this route plus the CLI script are the two ways to record
 * an allocation today. Wiring a UI control into app/admin/page.tsx's
 * Material Ledger (e.g. an "Allocate to Client" action next to "Manage")
 * is a natural follow-up once buyer accounts exist to allocate to.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { allocatePassportToClient } from "@/lib/services/allocate-passport-to-client";

const AllocateSchema = z.object({
  clientId: z.string().uuid("clientId must be a valid client UUID"),
  batchId: z.string().min(1, "batchId is required"),
  quantityKg: z.coerce.number().positive().optional(),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = AllocateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await allocatePassportToClient(parsed.data, role);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, data: result.data }, { status: result.status });
  } catch (error) {
    console.error("POST /api/admin/client-purchases failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record client purchase allocation" },
      { status: 500 }
    );
  }
}
