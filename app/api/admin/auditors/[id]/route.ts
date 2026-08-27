/**
 * app/api/admin/auditors/[id]/route.ts
 * -----------------------------------------------------------------------
 * PATCH /api/admin/auditors/{id} — the three post-creation account
 * management operations on a single Auditor row, dispatched by an
 * `action` discriminator in the body:
 *   - { action: "SET_ACTIVE", active: boolean } — soft activate/deactivate
 *   - { action: "ROTATE_KEY" }                  — issue a new personal API
 *                                                  key, shown ONCE in the
 *                                                  response
 *   - { action: "SET_PASSWORD", password: string } — set/reset the
 *                                                      /login password
 *
 * One discriminated PATCH endpoint rather than three separate sub-routes
 * (unlike e.g. app/api/admin/supplier-submissions/[id]/approve+reject) —
 * a deliberate, smaller-surface choice for this feature: these three
 * operations are all "update this account," not independent workflows
 * with their own review states the way approve/reject are, so one
 * endpoint with a typed discriminated body reads as clearly RESTful
 * without three near-empty route files. Gated ADMIN via lib/rbac.ts, same
 * as every other admin-only mutation. The in-app admin console instead
 * calls lib/actions/manage-auditor-accounts.ts's Server Actions directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { setAuditorActive, rotateAuditorApiKey, setAuditorPassword } from "@/lib/services/manage-auditor-accounts";

const PatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SET_ACTIVE"), active: z.boolean() }),
  z.object({ action: z.literal("ROTATE_KEY") }),
  z.object({ action: z.literal("SET_PASSWORD"), password: z.string().min(8).max(200) }),
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    if (parsed.data.action === "SET_ACTIVE") {
      const result = await setAuditorActive(id, parsed.data.active, role);
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      return NextResponse.json({ success: true, data: { auditor: result.data } }, { status: result.status });
    }

    if (parsed.data.action === "ROTATE_KEY") {
      const result = await rotateAuditorApiKey(id, role);
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      return NextResponse.json(
        { success: true, data: { auditor: result.data.auditor, rawApiKey: result.data.rawApiKey } },
        { status: result.status }
      );
    }

    // action === "SET_PASSWORD"
    const result = await setAuditorPassword(id, { password: parsed.data.password }, role);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, data: { auditor: result.data } }, { status: result.status });
  } catch (error) {
    console.error(`PATCH /api/admin/auditors/${id} failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to update auditor account" }, { status: 500 });
  }
}
