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
 *
 * Bug fix — "useToast must be used within a ToastProvider" crash: this
 * page renders AccessControlDashboard, which calls useToast() (see
 * lib/hooks/use-toast.tsx) unconditionally on every render to report
 * mutation results. Unlike app/page.tsx and app/admin/page.tsx — which
 * each wrap their own tree in a local <ToastProvider> — this page had no
 * provider anywhere above it (there is no global one in app/layout.tsx
 * either), so the context lookup threw immediately on first render. Wrapped
 * here in <ToastProvider>, matching the same established per-page pattern
 * those two pages already use, rather than adding a new global provider.
 */

import { AccessControlDashboard } from "@/components/dashboard/access-control/access-control-dashboard";
import { ToastProvider } from "@/lib/hooks/use-toast";

export const dynamic = "force-dynamic";

export default function AccountsPage() {
  return (
    <ToastProvider>
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
    </ToastProvider>
  );
}
