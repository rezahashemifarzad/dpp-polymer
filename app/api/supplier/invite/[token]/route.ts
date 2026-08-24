/**
 * app/api/supplier/invite/[token]/route.ts
 * -----------------------------------------------------------------------
 * GET  /api/supplier/invite/{token}  — public. Resolves an invite token
 *      and returns a sanitized subset of the SupplierInvite (company/
 *      contact context for the submission page to render) — never the
 *      tokenHash or internal id beyond what the form itself needs.
 * POST /api/supplier/invite/{token}  — public. Accepts one proposed batch
 *      submission for a resolved, active, non-expired invite.
 *
 * Both handlers are intentionally public/unauthenticated in the RBAC
 * sense: the token itself IS the credential (same reasoning as the
 * auditor/client portals' own bearer keys, just delivered via URL path
 * instead of a header) — see lib/supplier-invite-auth.ts. An invalid,
 * revoked, or expired token resolves to the same 404 either way, so a
 * guess never learns anything about which case it hit.
 *
 * Params are awaited per Next.js 16 App Router conventions (dynamic route
 * params are async in this Next.js version — see AGENTS.md).
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveSupplierInvite, supplierInviteNotFoundResponse } from "@/lib/supplier-invite-auth";
import { submitSupplierSubmission } from "@/lib/services/supplier-submission";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const invite = await resolveSupplierInvite(token);
    if (!invite) {
      return supplierInviteNotFoundResponse();
    }

    return NextResponse.json({
      success: true,
      data: {
        companyName: invite.companyName,
        contactName: invite.contactName,
        country: invite.country,
      },
    });
  } catch (error) {
    console.error(`GET /api/supplier/invite/[token] failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to resolve supplier invite" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const invite = await resolveSupplierInvite(token);
    if (!invite) {
      return supplierInviteNotFoundResponse();
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
    }

    const result = await submitSupplierSubmission(invite, body);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, issues: result.issues },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, data: { submissionId: result.data.id } }, { status: result.status });
  } catch (error) {
    console.error(`POST /api/supplier/invite/[token] failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to submit batch proposal" }, { status: 500 });
  }
}
