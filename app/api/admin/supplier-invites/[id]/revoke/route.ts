/**
 * app/api/admin/supplier-invites/[id]/revoke/route.ts
 * -----------------------------------------------------------------------
 * POST /api/admin/supplier-invites/{id}/revoke — soft-revokes a supplier
 * invite (active: false), same "flip a boolean, keep history" convention
 * as Auditor.active/Client.active. Gated to ADMIN via lib/rbac.ts. Params
 * are awaited per Next.js 16 App Router conventions.
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { revokeSupplierInvite } from "@/lib/services/supplier-submission";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  try {
    const result = await revokeSupplierInvite(id);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error(`POST /api/admin/supplier-invites/${id}/revoke failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to revoke supplier invite" }, { status: 500 });
  }
}
