import type { PayCycleStatus } from '@/src/lib/payCycleDates';

interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
}

export default function EarlyCycleWarnings({ cycle }: { cycle: PayCycleStatus }) {
  // Use the exact cycle already calculated for the dashboard.
  // Hardcoded examples remain until a recurring_bills table is available.
  const upcomingBills: Bill[] = [
    { id: '1', name: 'Manitoba Hydro', amount: 120.00, dueDate: '2026-09-29' },
    { id: '2', name: '2023 Mitsubishi RVR ES AWC Payment', amount: 350.00, dueDate: '2026-10-02' }
  ];
  const cycleEnd = new Date(`${cycle.cycle_end}T00:00:00Z`);
  const atRiskBills = upcomingBills.filter(bill => {
    const billDate = new Date(`${bill.dueDate}T00:00:00Z`);
    const diffDays = (billDate.getTime() - cycleEnd.getTime()) / 86_400_000;
    return diffDays >= 0 && diffDays <= 5;
  });

  return (
    <div className="space-y-4 font-sans">
      {/* Early Cycle Pre-funding Warnings */}
      {atRiskBills.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-500/20 p-6 rounded-2xl shadow-lg">
          <div className="space-y-1.5 mb-6">
            <h3 className="text-lg font-bold tracking-tight text-amber-500 flex items-center gap-2">
              <span className="text-xl">⚠️</span> Pre-Funding Required
            </h3>
            <p className="text-sm text-amber-500/80 font-medium leading-relaxed">
              These bills are due before your next paycheck clears. Hold funds from your current cycle to avoid overdrafting.
            </p>
          </div>

          <div className="space-y-3">
            {atRiskBills.map(bill => (
              <div key={bill.id} className="flex items-center justify-between bg-slate-950/50 border border-slate-800 p-4 rounded-xl transition-colors hover:border-amber-500/30">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-200">{bill.name}</span>
                  <span className="text-xs font-medium text-slate-500 mt-1">Due: {bill.dueDate}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-amber-400 text-lg">${bill.amount.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
