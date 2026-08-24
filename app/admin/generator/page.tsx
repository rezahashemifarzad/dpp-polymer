"use client";

/**
 * app/admin/generator/page.tsx
 * -----------------------------------------------------------------------
 * Phase 6 (Batch Certificate & Dynamic QR Generator Suite) — the dedicated
 * UI suite requested by Phase 6 §2 ("Create a dedicated UI suite ... at
 * /admin/generator or similar allowing admins to preview, customize, and
 * print high-resolution batch labels and official summary certificates").
 *
 * Distinct from app/page.tsx's existing "QR Generator" tab: that tab is
 * explicitly a design sandbox over locally-typed slider values (a
 * client-only GS1 URI preview with no real batch data — see its own
 * "(design sandbox)" comment) and was left untouched, since rebuilding it
 * in place would risk the exact kind of accidental regression the
 * project's Baseline Rule warns against. This page is the real,
 * production tool: it operates on live, persisted passports via
 * usePassports() and is what an admin actually uses to generate
 * certificates and print-ready label sheets for real batches.
 *
 * "use client" + ToastProvider wrap, mirroring app/admin/page.tsx's own
 * top-level pattern (rather than audit/green-accounting's
 * Server-Component-fetches-then-hands-to-client-dashboard split) — this
 * suite needs the same live, mutable client data the Material Ledger
 * itself uses (a batch issued moments ago elsewhere in the app must be
 * selectable here without a full reload), not a one-time server snapshot.
 *
 * useSearchParams() (for the optional `?batchId=` deep link — see
 * GeneratorSuiteDashboard's own banner) requires a Suspense boundary in
 * the App Router; this file's only other job is providing that boundary
 * and the toast context.
 */

import { Suspense } from "react";
import { ToastProvider } from "@/lib/hooks/use-toast";
import { GeneratorSuiteDashboard } from "@/components/dashboard/generator-suite-dashboard";

export default function GeneratorSuitePage() {
  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <GeneratorSuiteDashboard />
      </Suspense>
    </ToastProvider>
  );
}
