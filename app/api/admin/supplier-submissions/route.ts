/**
 * app/api/admin/supplier-submissions/route.ts
 * -----------------------------------------------------------------------
 * GET /api/admin/supplier-submissions[?status=PENDING|APPROVED|REJECTED]
 * — external-caller entry point for the admin review queue. Gated to
 * ADMIN via lib/rbac.ts (unlike GET /api/certifications/expiry-alerts,
 * this data includes supplier contact PII and unreviewed proposed batch
 * data, so it stays behind the same RBAC every other admin-only read/
 * write route in this app uses). The in-app admin console instead calls
 * lib/actions/list-supplier-submissions.ts's Server Action directly (same
 * dual-path pattern used everywhere else in this app).
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { listSupplierSubmissions } from "@/lib/services/supplier-submission";
import type { SupplierSubmissionStatus } from "@prisma/client";

const VALID_STATUSES: SupplierSubmissionStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export async function GET(req: NextRequest) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  const statusParam = req.nextUrl.searchParams.get("status");
  if (statusParam && !VALID_STATUSES.includes(statusParam as SupplierSubmissionStatus)) {
    return NextResponse.json(
      { success: false, error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const submissions = await listSupplierSubmissions(statusParam as SupplierSubmissionStatus | undefined);
    return NextResponse.json({ success: true, data: submissions });
  } catch (error) {
    console.error("GET /api/admin/supplier-submissions failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load supplier submissions" }, { status: 500 });
  }
}
