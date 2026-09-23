'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/src/lib/supabase/client';

interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
}

interface CycleStatus {
  cycle_start: string;
  cycle_end: string;
  days_remaining: number;
  is_magic_month: boolean;
  error?: string;
}

export default function EarlyCycleWarnings({ userId }: { userId: string }) {
  const [cycle, setCycle] = useState<CycleStatus | null>(null);
  const [atRiskBills, setAtRiskBills] = useState<Bill[]>([]);

  useEffect(() => {
    async function fetchCycleAndBills() {
      const supabase = createClient();
      // Fetch cycle boundaries from the Postgres function
      const { data: cycleData, error } = await supabase
        .rpc('get_pay_cycle_status', { p_user_id: userId });
      
      if (cycleData && !(cycleData as CycleStatus).error && !error) {
        setCycle(cycleData as CycleStatus);

        // In a full implementation, this fetches from a `recurring_bills` table
        // Hardcoded realistic examples for UI demonstration
        const upcomingBills: Bill[] = [
          { id: '1', name: 'Manitoba Hydro', amount: 120.00, dueDate: '2026-09-29' },
          { id: '2', name: '2023 Mitsubishi RVR ES AWC Payment', amount: 350.00, dueDate: '2026-10-02' }
        ];

        // Filter bills that fall immediately after the current cycle ends
        // requiring funds from THIS paycheck to avoid overdrafting
        const cycleEnd = new Date((cycleData as CycleStatus).cycle_end);
        const flagged = upcomingBills.filter(bill => {
          const billDate = new Date(bill.dueDate);
          const diffTime = billDate.getTime() - cycleEnd.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          // Flag if it's due within 5 days AFTER the current cycle ends
          return diffDays >= 0 && diffDays <= 5;
        });

        setAtRiskBills(flagged);
      }
    }
    
    if (userId) {
      fetchCycleAndBills();
    }
  }, [userId]);

  if (!cycle) return null;

  return (
    <div className="space-y-4 font-sans">
      {/* Magic Month Banner */}
      {cycle.is_magic_month && (
        <div className="relative overflow-hidden bg-indigo-950/40 border border-indigo-500/30 p-6 rounded-2xl shadow-lg transition-all hover:border-indigo-500/50">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-indigo-500/20 rounded-full mix-blend-screen filter blur-2xl animate-pulse" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <h3 className="text-xl font-bold tracking-tight text-indigo-100 flex items-center gap-2">
                <span>✨</span> Magic Month Detected
              </h3>
              <p className="text-sm text-indigo-200/80 font-medium leading-relaxed max-w-md">
                You receive 3 paychecks this month. Route the surplus to your emergency fund to accelerate your financial goals.
              </p>
            </div>
            
            <button className="whitespace-nowrap inline-flex items-center justify-center px-6 py-3 rounded-xl bg-indigo-500 text-slate-50 font-bold text-sm shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] hover:bg-indigo-400 transition-all active:scale-95 shrink-0">
              Route Funds
            </button>
          </div>
        </div>
      )}

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
