/**
 * app/api/certifications/[id]/acknowledge-alert/route.ts
 * -----------------------------------------------------------------------
 * POST /api/certifications/{id}/acknowledge-alert — Phase 4 - Step 1:
 * Automated Expiry & Compliance Alerts. External-caller entry point for
 * dismissing a raised expiry alert; the in-app admin widget instead calls
 * lib/actions/acknowledge-expiry-alert.ts's Server Action directly (same
 * dual-path pattern used everywhere else in this app).
 *
 * Gated to ADMIN via lib/rbac.ts — mirrors PATCH /api/certifications/[id]'s
 * own AUDITOR/ADMIN gate; acknowledgment specifically is admin-only since
 * it doesn't require the material-science judgment a verify/reject
 * decision does — it's simply "someone has seen this and is on it."
 *
 * Params are awaited per Next.js 16 App Router conventions (dynamic route
 * params are async in this Next.js version — see AGENTS.md).
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { acknowledgeExpiryAlert } from "@/lib/services/expiry-alert-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  try {
    const result = await acknowledgeExpiryAlert(id, role);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`POST /api/certifications/${id}/acknowledge-alert failed:`, error);
    return NextResponse.json(
      { success: false, error: "Failed to acknowledge alert" },
      { status: 500 }
    );
  }
}
