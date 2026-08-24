/**
 * app/api/admin/supplier-invites/route.ts
 * -----------------------------------------------------------------------
 * GET  /api/admin/supplier-invites — list all supplier invites.
 * POST /api/admin/supplier-invites — create a new supplier invite.
 *
 * External-caller entry points for the Supplier Onboarding Portal's
 * invite management, gated to ADMIN via lib/rbac.ts — same interim RBAC
 * every other admin-only mutation in this app uses. The in-app admin
 * console instead calls lib/actions/create-supplier-invite.ts /
 * lib/actions/list-supplier-invites.ts's Server Actions directly (same
 * dual-path pattern used everywhere else in this app — see
 * app/api/certifications/[id]/acknowledge-alert/route.ts's own banner).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { createSupplierInvite, listSupplierInvites } from "@/lib/services/supplier-submission";

const CreateInviteSchema = z.object({
  companyName: z.string().min(1),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  country: z.string().min(1),
  expiresAt: z.coerce.date().optional(),
});

export async function GET(req: NextRequest) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  try {
    const invites = await listSupplierInvites();
    return NextResponse.json({ success: true, data: invites });
  } catch (error) {
    console.error("GET /api/admin/supplier-invites failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load supplier invites" }, { status: 500 });
  }
}

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

  const parsed = CreateInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await createSupplierInvite(parsed.data, role);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json(
      {
        success: true,
        data: {
          invite: result.data.invite,
          // Shown ONCE — never recoverable after this response, same
          // convention as scripts/create-auditor.ts's CLI output.
          rawToken: result.data.rawToken,
          submitUrl: result.data.submitUrl,
        },
      },
      { status: result.status }
    );
  } catch (error) {
    console.error("POST /api/admin/supplier-invites failed:", error);
    return NextResponse.json({ success: false, error: "Failed to create supplier invite" }, { status: 500 });
  }
}
