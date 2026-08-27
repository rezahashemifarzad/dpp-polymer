/**
 * app/api/admin/auditors/route.ts
 * -----------------------------------------------------------------------
 * GET  /api/admin/auditors — list all Auditor accounts.
 * POST /api/admin/auditors — provision a new Auditor account (personal
 *                             API key, optional password).
 *
 * External-caller entry points for the Admin UI for Auditor & Buyer
 * Accounts, gated to ADMIN via lib/rbac.ts — same interim RBAC every
 * other admin-only mutation in this app uses. The in-app admin console
 * instead calls lib/actions/manage-auditor-accounts.ts's Server Actions
 * directly (same dual-path pattern as app/api/admin/supplier-invites/route.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { listAuditorAccounts, createAuditorAccount } from "@/lib/services/manage-auditor-accounts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  try {
    const data = await listAuditorAccounts();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/admin/auditors failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load auditor accounts" }, { status: 500 });
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

  const result = await createAuditorAccount(body, role);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, issues: "issues" in result ? result.issues : undefined },
      { status: result.status }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        auditor: result.data.auditor,
        // Shown ONCE — never recoverable after this response, same
        // convention as scripts/create-auditor.ts's CLI output.
        rawApiKey: result.data.rawApiKey,
      },
    },
    { status: result.status }
  );
}
