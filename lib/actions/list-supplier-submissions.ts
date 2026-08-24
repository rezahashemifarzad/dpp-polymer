"use server";

/**
 * lib/actions/list-supplier-submissions.ts
 * -----------------------------------------------------------------------
 * Server Action backing the admin review queue widget
 * (components/dashboard/supplier-review-panel.tsx). Deliberately a Server
 * Action rather than a public fetch() to a REST route the way
 * ExpiryAlertBanner reads its own portfolio summary: that widget's data
 * (certification expiry dates) is no more sensitive than what a public QR
 * scan already reveals, so its GET route stays public by design (see that
 * route's own file banner). Supplier submissions carry a supplier
 * company's contact details and unreviewed proposed batch data — real PII
 * that has no business being reachable by an unauthenticated GET, so this
 * reads through the same server-only path every mutation on this feature
 * uses instead. External/API callers use GET /api/admin/supplier-submissions
 * (ADMIN-gated) for the same data.
 */

import { listSupplierSubmissions } from "@/lib/services/supplier-submission";
import type { SupplierSubmissionStatus } from "@prisma/client";

export interface ListSupplierSubmissionsActionResult {
  ok: boolean;
  data?: unknown[];
  error?: string;
}

/**
 * Round-trips through JSON for the same reason
 * lib/actions/create-passport.ts's toPlainJson does — Server Action return
 * values cross the RSC boundary through Next's own serialization, which
 * doesn't know how to send a Prisma.Decimal or Date instance; JSON.stringify
 * calls each value's toJSON() and gives the client the same plain-string
 * shape the JSON API routes already return.
 */
function toPlainJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

export async function listSupplierSubmissionsAction(
  status?: SupplierSubmissionStatus
): Promise<ListSupplierSubmissionsActionResult> {
  try {
    const submissions = await listSupplierSubmissions(status);
    return { ok: true, data: toPlainJson(submissions) as unknown[] };
  } catch (error) {
    console.error("listSupplierSubmissionsAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to load supplier submissions" };
  }
}
