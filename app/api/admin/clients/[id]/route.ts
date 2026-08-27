/**
 * app/api/admin/clients/[id]/route.ts
 * -----------------------------------------------------------------------
 * PATCH /api/admin/clients/{id} — the three post-creation account
 * management operations on a single Client row, dispatched by an
 * `action` discriminator in the body. Mirrors
 * app/api/admin/auditors/[id]/route.ts exactly — see that file's own
 * banner for the full rationale (one discriminated PATCH endpoint rather
 * than three sub-routes).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { setClientActive, rotateClientApiKey, setClientPassword } from "@/lib/services/manage-client-accounts";

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
      const result = await setClientActive(id, parsed.data.active, role);
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      return NextResponse.json({ success: true, data: { client: result.data } }, { status: result.status });
    }

    if (parsed.data.action === "ROTATE_KEY") {
      const result = await rotateClientApiKey(id, role);
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      return NextResponse.json(
        { success: true, data: { client: result.data.client, rawApiKey: result.data.rawApiKey } },
        { status: result.status }
      );
    }

    // action === "SET_PASSWORD"
    const result = await setClientPassword(id, { password: parsed.data.password }, role);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, data: { client: result.data } }, { status: result.status });
  } catch (error) {
    console.error(`PATCH /api/admin/clients/${id} failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to update client account" }, { status: 500 });
  }
}
