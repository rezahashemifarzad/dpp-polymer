/**
 * app/admin/audit/page.tsx
 * -----------------------------------------------------------------------
 * Phase 4 - Step 3: Immutable Audit Trail / Ledger Log — dedicated admin
 * page. A Server Component — fetches the first page of the audit ledger
 * (lib/services/audit-log-service.ts's listAuditLogEntries) and the
 * current filter option set (getAuditLogFilterOptions) directly
 * server-side, mirroring app/admin/green-accounting/page.tsx's own
 * pattern, then hands both to the client dashboard for interactive
 * filtering/pagination/export/verification.
 *
 * force-dynamic: this is a live, append-only ledger, not a marketing
 * page — every load must reflect the latest entries, never a stale
 * build-time cache. Same reasoning as every other /admin/* page in this
 * app.
 */

import { Suspense } from "react";
import { listAuditLogEntries, getAuditLogFilterOptions, AUDIT_LOG_DEFAULT_PAGE_SIZE } from "@/lib/services/audit-log-service";
import { AuditLogDashboard } from "@/components/dashboard/audit-log-dashboard";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const [result, filterOptions] = await Promise.all([
    listAuditLogEntries({}, 1, AUDIT_LOG_DEFAULT_PAGE_SIZE),
    getAuditLogFilterOptions(),
  ]);

  // Phase 7 - Step 3 — AuditLogDashboard now reads the optional
  // `?batchId=` deep link via useSearchParams() (see that file's own
  // comment), which requires a Suspense boundary in the App Router; same
  // pattern app/admin/generator/page.tsx already established for its own
  // ?batchId= deep link.
  return (
    <Suspense fallback={null}>
      <AuditLogDashboard initialResult={result} initialFilterOptions={filterOptions} />
    </Suspense>
  );
}
