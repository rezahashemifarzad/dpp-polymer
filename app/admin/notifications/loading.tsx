/**
 * app/admin/notifications/loading.tsx
 * -----------------------------------------------------------------------
 * Bug-fix companion to app/admin/notifications/error.tsx — this route had
 * neither a loading nor an error boundary. Same skeleton convention as
 * app/admin/esg-analytics/loading.tsx, shaped for
 * NotificationCenterDashboard's own layout instead (overview chips →
 * settings + webhooks cards → delivery log table).
 */

function Card({ className = "" }: { className?: string }) {
  return <div className={`bg-slate-900/60 border border-slate-800 rounded-3xl backdrop-blur-xl ${className}`} />;
}

function ChipSkeleton() {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 backdrop-blur-xl">
      <div className="h-2.5 w-16 bg-slate-800 rounded" />
      <div className="h-6 w-10 bg-slate-800 rounded mt-3" />
    </div>
  );
}

export default function NotificationsLoading() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans overflow-x-hidden animate-pulse">
      {/* Bug fix — same top-offset fix as NotificationCenterDashboard's
          real header (see that file's own comment); this skeleton mirrors
          its layout, so it needs the same shared admin-offset token. */}
      <header className="border-b border-slate-800/80 bg-[#070c18]/90 backdrop-blur-2xl sticky top-admin-offset z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-16 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-9 w-32 bg-slate-800 rounded-lg shrink-0" />
            <div>
              <div className="h-4 w-56 bg-slate-800 rounded" />
              <div className="h-2.5 w-32 bg-slate-800 rounded mt-2" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <ChipSkeleton />
          <ChipSkeleton />
          <ChipSkeleton />
          <ChipSkeleton />
          <ChipSkeleton />
          <ChipSkeleton />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="h-72" />
          <Card className="h-72" />
        </div>

        <Card className="h-96" />
      </main>
    </div>
  );
}
