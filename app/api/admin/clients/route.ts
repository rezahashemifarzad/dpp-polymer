/**
 * app/api/admin/clients/route.ts
 * -----------------------------------------------------------------------
 * GET  /api/admin/clients — list all Client (buyer company) accounts.
 * POST /api/admin/clients — provision a new Client account (company API
 *                            key, optional password).
 *
 * Mirrors app/api/admin/auditors/route.ts exactly — see that file's own
 * banner for the shared rationale. Gated ADMIN via lib/rbac.ts; the
 * in-app admin console instead calls
 * lib/actions/manage-client-accounts.ts's Server Actions directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { listClientAccounts, createClientAccount } from "@/lib/services/manage-client-accounts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  try {
    const data = await listClientAccounts();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/admin/clients failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load client accounts" }, { status: 500 });
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

  const result = await createClientAccount(body, role);
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
        client: result.data.client,
        // Shown ONCE — never recoverable after this response, same
        // convention as scripts/create-client.ts's CLI output.
        rawApiKey: result.data.rawApiKey,
      },
    },
    { status: result.status }
  );
}
