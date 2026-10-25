import type { SpendingTotals } from '@/src/lib/spendingTotals';

export default function TotalSpendCard({ operational, exempt, total }: SpendingTotals) {
  return (
    <section aria-labelledby="total-spent-heading" className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-4">
      <div>
        <h2 id="total-spent-heading" className="text-sm font-bold uppercase tracking-wider text-slate-300">Total spent</h2>
        <p className="mt-2 text-4xl font-black tracking-tight text-emerald-400 break-all tabular-nums">${total.toFixed(2)}</p>
        <p className="mt-2 text-xs text-slate-400">All spending in your active cycle, across every payment method.</p>
      </div>
      <dl className="grid grid-cols-2 gap-4 border-t border-emerald-500/20 pt-4 text-sm">
        <div className="min-w-0">
          <dt className="text-slate-400">Operational</dt>
          <dd className="mt-1 font-bold text-slate-100 break-all tabular-nums">${operational.toFixed(2)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-400">Exempt</dt>
          <dd className="mt-1 font-bold text-indigo-300 break-all tabular-nums">${exempt.toFixed(2)}</dd>
        </div>
      </dl>
    </section>
  );
}
