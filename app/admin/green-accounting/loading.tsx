/**
 * app/admin/green-accounting/loading.tsx
 * -----------------------------------------------------------------------
 * Final Polish & Stability Sprint — Next.js App Router loading UI, shown
 * automatically while the Server Component in page.tsx resolves its three
 * parallel data fetches (computePortfolioGreenAccounting,
 * listTaxParameters, computeGreenTaxTrendForecast). Without this file the
 * browser just shows a blank tab during that fetch; this is the first
 * loading.tsx in this app, establishing the pattern other admin pages can
 * adopt the same way.
 *
 * Mirrors the page's real layout (header → 4 KPI cards → tax parameter
 * panel → per-batch table → 4 forecast KPI cards → 2 charts → 2 tables →
 * footer) at roughly the right proportions, so the transition from
 * skeleton to real content doesn't visibly jump — same
 * animate-pulse/bg-slate-800 skeleton convention as
 * components/dashboard/passport-skeleton.tsx.
 */

function Card({ className = "" }: { className?: string }) {
  return <div className={`bg-slate-900/60 border border-slate-800 rounded-3xl backdrop-blur-xl ${className}`} />;
}

function KpiCardSkeleton() {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
      <div className="h-2.5 w-24 bg-slate-800 rounded" />
      <div className="h-7 w-28 bg-slate-800 rounded mt-3" />
      <div className="h-2.5 w-32 bg-slate-800 rounded mt-3" />
    </div>
  );
}

export default function GreenAccountingLoading() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans animate-pulse">
      {/* Sticky Header Overlap fix, round 2 (2026-09-28) — mirrors
          GreenAccountingDashboard's real header fix (see that file's own
          comment and app/globals.css's): `overflow-x-hidden` moved off this
          wrapper (it was silently turning it into a scroll container that
          broke `position: sticky` below) and onto <main>, and the offset
          switched from a Tailwind utility class to the `--admin-content-
          offset` CSS custom property via inline style. */}
      <header
        className="border-b border-slate-800/80 bg-[#070c18]/90 backdrop-blur-2xl sticky z-40"
        style={{ top: "var(--admin-content-offset)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-16 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-9 w-32 bg-slate-800 rounded-lg shrink-0" />
            <div>
              <div className="h-4 w-48 bg-slate-800 rounded" />
              <div className="h-2.5 w-32 bg-slate-800 rounded mt-2" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-8 w-20 bg-slate-800 rounded-lg" />
            <div className="h-8 w-16 bg-slate-800 rounded-lg" />
            <div className="h-8 w-40 bg-slate-800 rounded-lg" />
            <div className="h-8 w-36 bg-slate-800 rounded-lg" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8 overflow-x-hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
        </div>

        <Card className="h-40" />
        <Card className="h-56" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="h-56" />
          <Card className="h-56" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="h-64" />
          <Card className="h-64" />
        </div>

        <Card className="h-20" />
      </main>
    </div>
  );
}
