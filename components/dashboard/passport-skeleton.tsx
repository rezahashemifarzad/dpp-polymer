/**
 * components/dashboard/passport-skeleton.tsx
 * -----------------------------------------------------------------------
 * Loading placeholder for a single passport card, shown while
 * usePassports() has not yet resolved its first fetch.
 */

export function PassportSkeleton() {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="h-5 w-28 bg-slate-800 rounded-lg" />
        <div className="h-7 w-7 bg-slate-800 rounded-lg" />
      </div>
      <div className="h-4 w-40 bg-slate-800 rounded mb-2" />
      <div className="h-3 w-24 bg-slate-800 rounded mb-4" />
      <div className="space-y-2 border-t border-slate-800 pt-3">
        <div className="h-3 w-full bg-slate-800 rounded" />
        <div className="h-3 w-5/6 bg-slate-800 rounded" />
        <div className="h-3 w-4/6 bg-slate-800 rounded" />
        <div className="h-3 w-3/6 bg-slate-800 rounded" />
      </div>
    </div>
  );
}

export function PassportRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="py-4 px-4"><div className="h-3 w-24 bg-slate-800 rounded" /></td>
      <td className="py-4 px-4"><div className="h-3 w-32 bg-slate-800 rounded" /></td>
      <td className="py-4 px-4"><div className="h-3 w-28 bg-slate-800 rounded" /></td>
      <td className="py-4 px-4"><div className="h-3 w-10 bg-slate-800 rounded" /></td>
      <td className="py-4 px-4"><div className="h-3 w-20 bg-slate-800 rounded" /></td>
      <td className="py-4 px-4"><div className="h-3 w-14 bg-slate-800 rounded" /></td>
      <td className="py-4 px-4 text-right"><div className="h-6 w-24 bg-slate-800 rounded ml-auto" /></td>
    </tr>
  );
}
