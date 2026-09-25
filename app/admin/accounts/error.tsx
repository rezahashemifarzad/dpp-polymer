"use client";

/**
 * app/admin/accounts/error.tsx
 * -----------------------------------------------------------------------
 * Bug fix — "/admin/accounts is blank/non-functional." page.tsx itself is
 * static (no data fetching), so this route never had a render-time crash
 * of its own; the actual failure mode was AccountAuditLog writes (every
 * create/activate/deactivate/rotate/set-password mutation in
 * lib/services/manage-auditor-accounts.ts / manage-client-accounts.ts
 * writes one inside the same $transaction, via
 * lib/services/account-audit-log.ts's writeAccountAuditLog) throwing a raw,
 * unhelpful Prisma error whenever the AccountAuditLog table hadn't been
 * `db push`-ed to the connected database yet (see
 * lib/services/schema-drift.ts's file banner) — every action on this page
 * would fail with a cryptic message, which reads as "non-functional" even
 * though the page itself renders. writeAccountAuditLog is now wrapped in
 * wrapSchemaDrift() so that error is now a clear, actionable one surfaced
 * in the existing toast (see access-control-dashboard.tsx's catch blocks).
 *
 * This error.tsx/loading.tsx pair is added alongside that fix purely for
 * defense-in-depth / consistency with every other /admin/* route that
 * already has one (esg-analytics, green-accounting) — not because this
 * specific page had a render crash, but because it's the same "zero
 * unguarded admin route" standard the rest of the app already holds to.
 */

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, AlertTriangle } from "lucide-react";

export default function AccountsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Access Control (Accounts) page failed to load:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-rose-400" />
        </div>
        <h1 className="text-base font-bold text-white">Access Control couldn&apos;t load</h1>
        <p className="text-[11px] text-slate-400 font-mono mt-2 break-words">
          {error.message || "Something went wrong loading Auditor & Buyer accounts. This is usually transient — try again, or head back to the Admin Console."}
        </p>
        {error.digest && <p className="text-[10px] text-slate-600 font-mono mt-2">Error ref: {error.digest}</p>}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-lg transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Admin Console
          </Link>
        </div>
      </div>
    </div>
  );
}
