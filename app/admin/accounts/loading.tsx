/**
 * app/admin/accounts/loading.tsx
 * -----------------------------------------------------------------------
 * Companion to app/admin/accounts/error.tsx — see that file's comment.
 * Shaped for AccessControlDashboard's own layout (two account panels,
 * each header + table).
 */

function PanelSkeleton() {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className="h-4 w-40 bg-slate-800 rounded" />
        <div className="h-7 w-24 bg-slate-800 rounded-lg" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-8 bg-slate-800/60 rounded" />
        <div className="h-8 bg-slate-800/60 rounded" />
        <div className="h-8 bg-slate-800/60 rounded" />
      </div>
    </div>
  );
}

export default function AccountsLoading() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-8 animate-pulse">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="h-5 w-80 bg-slate-800 rounded" />
          <div className="h-2.5 w-full max-w-xl bg-slate-800 rounded mt-3" />
        </div>
        <div className="space-y-6">
          <PanelSkeleton />
          <PanelSkeleton />
        </div>
      </div>
    </div>
  );
}
