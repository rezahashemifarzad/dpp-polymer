"use client";

/**
 * app/admin/notifications/error.tsx
 * -----------------------------------------------------------------------
 * Bug fix — "/admin/notifications is inactive/not showing content."
 * page.tsx fetches computeNotificationCenterSummary() / listWebhookEndpoints()
 * / getNotificationSettings() directly in a server-rendered Promise.all with
 * no try/catch of its own; before this fix, any failure there (most likely
 * a Prisma P2021/P2022 — see lib/services/schema-drift.ts's file banner on
 * why this project's no-migration-history setup can leave the WebhookEndpoint
 * / NotificationSettings / NotificationLog tables un-pushed on a given
 * database) crashed the whole page render with no error boundary to catch
 * it, which is exactly what "inactive / not showing content" looks like.
 *
 * Same rationale/pattern as app/admin/esg-analytics/error.tsx, but shows
 * error.message directly rather than a generic string — matching this
 * app's own established convention for schema-drift-aware widgets (see
 * components/dashboard/reach-ppwr/svhc-compliance-banner.tsx, which
 * surfaces its API route's SchemaOutOfDateError message verbatim). That
 * message is actionable ("... run npx prisma db push ...") rather than
 * generic, and an admin needs to see it to actually fix this class of bug.
 */

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, AlertTriangle } from "lucide-react";

export default function NotificationsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Notifications page failed to load:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-rose-400" />
        </div>
        <h1 className="text-base font-bold text-white">Notifications &amp; Webhooks couldn&apos;t load</h1>
        <p className="text-[11px] text-slate-400 font-mono mt-2 break-words">
          {error.message || "Something went wrong loading the notification center. This is usually transient — try again, or head back to the Admin Console."}
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
