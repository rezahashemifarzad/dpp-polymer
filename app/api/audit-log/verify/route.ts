/**
 * app/api/audit-log/verify/route.ts
 * -----------------------------------------------------------------------
 * GET /api/audit-log/verify — runs a full hash-chain integrity check over
 * the entire AuditLog table (lib/services/audit-log-service.ts's
 * verifyAuditLogChainIntegrity) and returns the result. Read-only and
 * idempotent — unlike POST/GET /api/certifications/expiry-check (which
 * WRITES notification bookkeeping), this never mutates anything, so a
 * plain GET is the right verb even though it does real, potentially
 * expensive work (a full table walk).
 *
 * Public / no RBAC gate — same rationale as GET /api/audit-log: this
 * derives entirely from already-public AuditLog data, and revealing
 * whether the ledger's integrity check currently passes is not itself
 * sensitive (the opposite, in fact — hiding it behind auth would be
 * actively unhelpful for the "official EU compliance audits" this
 * feature exists for).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAuditLogChainIntegrity } from "@/lib/services/audit-log-service";
import { authorizeApiRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Access-control audit (2026-09-30): ADMIN, AUDITOR only (session or API key).
  const auth = await authorizeApiRequest(req, ["ADMIN", "AUDITOR"]);
  if (!auth.ok) return auth.response;

  try {
    const result = await verifyAuditLogChainIntegrity();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("GET /api/audit-log/verify failed:", error);
    return NextResponse.json({ success: false, error: "Failed to verify audit log integrity" }, { status: 500 });
  }
}
