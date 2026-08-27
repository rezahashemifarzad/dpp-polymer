/**
 * app/admin/accounts/page.tsx
 * -----------------------------------------------------------------------
 * Admin UI for Auditor & Buyer Accounts. A thin Server Component shell —
 * all data fetching happens client-side through Server Actions (see
 * components/dashboard/access-control/access-control-dashboard.tsx), same
 * pattern as app/admin/suppliers/page.tsx's sibling
 * SupplierReviewPanel-on-app/admin/page.tsx widget, just promoted to its
 * own page since account management doesn't belong crowded onto the
 * already-dense Material Ledger admin page.
 *
 * force-dynamic: this is a live, operational account list, never served
 * from a stale build-time cache — same reasoning as every other
 * /admin/* page in this app.
 */

import { AccessControlDashboard } from "@/components/dashboard/access-control/access-control-dashboard";

export const dynamic = "force-dynamic";

export default function AccountsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-bold tracking-wide">Access Control — Auditor &amp; Buyer Accounts</h1>
          <p className="text-xs text-slate-400 mt-1">
            Provision, deactivate, and manage credentials for Auditor and Client (buyer) accounts — the same
            capability as scripts/create-auditor.ts / scripts/create-client.ts and their companion password/rotation
            scripts, from the admin console instead of a terminal.
          </p>
        </div>
        <AccessControlDashboard />
      </div>
    </div>
  );
}
