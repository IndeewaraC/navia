import { createClient } from '@/src/lib/supabase/server';
import EarlyCycleWarnings from '@/src/components/dashboard/EarlyCycleWarnings';
import QuickExpenseFAB from '@/src/components/dashboard/QuickExpenseFAB';
import MagicMonthBanner from '@/src/components/dashboard/MagicMonthBanner';
import TotalSpendCard from '@/src/components/dashboard/TotalSpendCard';
import { fetchSpendingTransactions } from '@/src/lib/analyze';
import { calculateSpendingTotals } from '@/src/lib/spendingTotals';

export default async function DashboardPage() {
  // Await createClient() as mandated by Next.js 15+ cookies() async restrictions
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null; // Middleware handles the redirect

  // 1. Fetch ALL Payment Accounts
  const { data: accounts } = await supabase
    .from('payment_accounts')
    .select('account_id, account_alias, routine_monthly_limit')
    .eq('user_id', user.id);



  // Fetch active projects for the FAB dropdown
  const { data: activeProjects } = await supabase
    .from('exempt_projects')
    .select('project_id, name')
    .eq('user_id', user.id);

  // Fetch the User's Profile for the Display Name
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();
    
  const dashboardTitle = profile?.display_name ? `${profile.display_name}'s Vault` : 'Command Center';

  // 2. Fetch Active Cycle Status
  const { data: cycleData } = await supabase.rpc('get_pay_cycle_status', { p_user_id: user.id });

  // 3. Fetch Spend Data for the Current Cycle
  // Use cycle start if available, otherwise fallback to the 1st of the current month
  const today = new Date().toISOString().slice(0, 10);
  let effectiveStartDate = `${today.slice(0, 7)}-01`;
  const isMissingAnchor = !cycleData || cycleData.error;
  
  if (!isMissingAnchor && cycleData?.cycle_start) {
    effectiveStartDate = cycleData.cycle_start.slice(0, 10);
  }

  const txns = await fetchSpendingTransactions(supabase, user.id, { startDate: effectiveStartDate, endDate: today });
  const spending = calculateSpendingTotals(txns);
  const operationalSpend = spending.operational;
  const exemptSpend = spending.exempt;

  const { data: recentTransactions } = await supabase
    .from('transactions')
    .select('transaction_id, amount, category, txn_type, is_budget_cap_exempt, transaction_date, created_at, source_account_id')
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .order('transaction_id', { ascending: false })
    .limit(10);

  // Calculate Dual-Layer Gauge logic
  // Use the sum of all monthly limits
  const limit = (accounts || []).reduce((acc, account) => acc + (account.routine_monthly_limit || 0), 0);
  const spendPercentage = limit > 0 ? Math.min((operationalSpend / limit) * 100, 100) : (operationalSpend > 0 ? 100 : 0);
  
  let progressColor = 'bg-emerald-400';
  if (spendPercentage >= 100) progressColor = 'bg-rose-500';
  else if (spendPercentage >= 80) progressColor = 'bg-amber-400';

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-6 pt-8">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-slate-100">{dashboardTitle}</h1>
        <p className="text-slate-400 font-medium text-sm">Active Cycle Overview</p>
      </header>

      <MagicMonthBanner isMagicMonth={cycleData?.is_magic_month || false} />

      {/* Spend Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Operational Spend Gauge */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[40px] rounded-full pointer-events-none" />
          
          <h2 className="text-slate-400 font-semibold mb-2 text-sm uppercase tracking-wider flex items-center gap-2">
            Operational Spend
            <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full border border-slate-700">Subject to Limit</span>
          </h2>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-4xl font-black tracking-tighter text-slate-100">${operationalSpend.toFixed(2)}</span>
            <span className="text-slate-500 font-bold">/ ${limit.toFixed(2)}</span>
          </div>

          <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/50">
            <div 
              className={`h-full ${progressColor} transition-all duration-1000 ease-out rounded-full`}
              style={{ width: `${spendPercentage}%` }}
            />
          </div>
        </section>

        {/* Exempt & Medical Spend */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[40px] rounded-full pointer-events-none" />
          
          <div>
            <h2 className="text-slate-400 font-semibold mb-2 text-sm uppercase tracking-wider flex items-center gap-2">
              Exempt Spend
              <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded-full border border-indigo-500/30">Medical & Vault</span>
            </h2>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-black tracking-tighter text-slate-100">${exemptSpend.toFixed(2)}</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Expenses tagged as exempt bypass the operational limit gauge.
            </p>
          </div>
        </section>
      </div>

      <TotalSpendCard operational={operationalSpend} exempt={exemptSpend} total={spending.total} />

      {/* Funding Sources */}
      {accounts && accounts.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 px-2">Active Funding Sources</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {accounts.map(acc => {
              const accountSpend = spending.perAccount.get(acc.account_id) || { operational: 0, exempt: 0, total: 0 };
              const accountLimit = Number(acc.routine_monthly_limit) || 0;
              const remaining = accountLimit - accountSpend.operational;
              const isOverLimit = remaining < 0;
              const remainingText = isOverLimit ? `-$${Math.abs(remaining).toFixed(2)}` : `$${remaining.toFixed(2)}`;
              
              return (
                <div key={acc.account_id} className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-center">
                  <span className="font-bold text-slate-200 text-sm truncate" title={acc.account_alias}>{acc.account_alias}</span>
                  <dl className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between gap-2"><dt className="text-slate-400">Operational spent</dt><dd className="font-semibold text-slate-200">${accountSpend.operational.toFixed(2)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-slate-400">Exempt spent</dt><dd className="font-semibold text-indigo-300">${accountSpend.exempt.toFixed(2)}</dd></div>
                    <div className="flex justify-between gap-2 border-t border-slate-800 pt-2 text-sm"><dt className="font-bold text-slate-200">Total spent</dt><dd className="font-black text-emerald-400">${accountSpend.total.toFixed(2)}</dd></div>
                  </dl>
                  {accountLimit > 0 ? (
                    <span className={`mt-3 text-xs ${isOverLimit ? 'text-rose-400' : 'text-slate-400'}`}>
                      {remainingText} {isOverLimit ? 'over' : 'left'} of ${accountLimit.toFixed(2)} operational limit
                    </span>
                  ) : <span className="mt-3 text-xs text-slate-500">No operational limit set</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Anchor Date Warning */}
      {isMissingAnchor && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <h3 className="text-amber-400 font-bold text-sm">Pay Cycle Not Aligned</h3>
            <p className="text-amber-500/80 text-xs mt-1">
              You haven&apos;t set your Anchor Pay Date in Settings. Navia is temporarily using the 1st of the month for calculations.
            </p>
          </div>
        </div>
      )}

      {/* Early Cycle Warning Injection */}
      {cycleData && cycleData.is_magic_month && (accounts || []).length > 0 && (
        <EarlyCycleWarnings userId={user.id} />
      )}

      {/* Recent Feed */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 px-2">Recent Transactions</h2>
        <div className="space-y-3">
          {recentTransactions && recentTransactions.length > 0 ? (
            recentTransactions.map((txn) => {
              const accountAlias = accounts?.find(a => a.account_id === txn.source_account_id)?.account_alias || 'Unknown Account';
              return (
                <div key={txn.transaction_id} className="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-200">{txn.category}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{new Date(`${txn.transaction_date.slice(0, 10)}T00:00:00`).toLocaleDateString()}</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800/50 border border-slate-700 px-1.5 py-0.5 rounded-md">
                        {accountAlias}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`font-black ${txn.txn_type === 'EXPENSE' ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {txn.txn_type === 'EXPENSE' ? '-' : '+'}${Number(txn.amount).toFixed(2)}
                    </span>
                    {txn.is_budget_cap_exempt && (
                      <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full mt-1">Exempt</span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center p-6 bg-slate-900/30 rounded-2xl border border-slate-800/30 border-dashed">
              <p className="text-slate-500 font-medium">No transactions yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Pass all accounts and active projects to the FAB so it can process transactions */}
      <QuickExpenseFAB 
        paymentAccounts={accounts || []} 
        activeProjects={activeProjects || []} 
      />
    </div>
  );
}
