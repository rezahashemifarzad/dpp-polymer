"use client";

/**
 * app/error.tsx
 * -----------------------------------------------------------------------
 * Root error boundary (repository audit 2026-10-22). Catches render/data
 * errors in every route that has no closer error.tsx — notably the public
 * GS1 scan page, the login page and the auditor/customer portals, which
 * previously fell through to the framework's raw crash screen on any
 * transient database error.
 *
 * Shows no error message text: in production Next.js replaces server error
 * messages with a generic one anyway, and the digest is the only value
 * worth surfacing (it matches the server log entry for support).
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Unhandled route error:", error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-1 items-center justify-center bg-slate-50 px-5 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm" role="alert">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-600">
          <AlertTriangle className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div className="space-y-4">
          <div lang="en">
            <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              This page could not be loaded. This is usually temporary — please try again.
            </p>
          </div>
          <div lang="de">
            <h2 className="text-base font-semibold text-slate-900">Etwas ist schiefgelaufen</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Diese Seite konnte nicht geladen werden. Das ist meist vorübergehend – bitte versuchen Sie es erneut.
            </p>
          </div>
          <div lang="fr">
            <h2 className="text-base font-semibold text-slate-900">Une erreur est survenue</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Cette page n&apos;a pas pu être chargée. C&apos;est généralement temporaire — veuillez réessayer.
            </p>
          </div>
        </div>
        {error.digest && (
          <p className="mt-5 font-mono text-xs text-slate-500">
            Ref: <span className="select-all">{error.digest}</span>
          </p>
        )}
        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Try again · Erneut versuchen · Réessayer</span>
          </button>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
