import { createClient } from '@/src/lib/supabase/server';
import EarlyCycleWarnings from '@/src/components/dashboard/EarlyCycleWarnings';
import QuickExpenseFAB from '@/src/components/dashboard/QuickExpenseFAB';

export default async function DashboardPage() {
  // Await createClient() as mandated by Next.js 15+ cookies() async restrictions
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null; // Middleware handles the redirect

  // 1. Fetch ALL Payment Accounts
  let { data: accounts } = await supabase
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
  let operationalSpend = 0;
  let exemptSpend = 0;
  let recentTransactions: any[] = [];

  // Use cycle start if available, otherwise fallback to the 1st of the current month
  let effectiveStartDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const isMissingAnchor = !cycleData || cycleData.error;
  
  if (!isMissingAnchor && cycleData?.cycle_start) {
    effectiveStartDate = cycleData.cycle_start;
  }

  const { data: txns } = await supabase
    .from('transactions')
    .select('amount, category, txn_type, is_budget_cap_exempt, transaction_date, source_account_id')
    .eq('user_id', user.id)
    .gte('transaction_date', effectiveStartDate)
    .order('transaction_date', { ascending: false });

  const spentPerAccount: Record<string, number> = {};

  if (txns) {
    recentTransactions = txns.slice(0, 5); // Grab latest 5 for the feed
    
    txns.forEach((txn) => {
      if (txn.txn_type === 'EXPENSE') {
        if (txn.is_budget_cap_exempt) {
          exemptSpend += Number(txn.amount);
        } else {
          operationalSpend += Number(txn.amount);
          if (txn.source_account_id) {
            spentPerAccount[txn.source_account_id] = (spentPerAccount[txn.source_account_id] || 0) + Number(txn.amount);
          }
        }
      }
    });
  }

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

      {/* Funding Sources */}
      {accounts && accounts.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 px-2">Active Funding Sources</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {accounts.filter(a => (a.routine_monthly_limit || 0) > 0).map(acc => {
              const spent = spentPerAccount[acc.account_id] || 0;
              const remaining = (acc.routine_monthly_limit || 0) - spent;
              const isOverLimit = remaining < 0;
              const remainingText = isOverLimit ? `-$${Math.abs(remaining).toFixed(2)}` : `$${remaining.toFixed(2)}`;
              
              return (
                <div key={acc.account_id} className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-center">
                  <span className="font-bold text-slate-200 text-sm truncate" title={acc.account_alias}>{acc.account_alias}</span>
                  <span className={`${isOverLimit ? 'text-rose-400' : 'text-emerald-400'} font-black mt-1`}>
                    {remainingText} <span className="text-slate-500 font-medium text-xs">{isOverLimit ? 'over' : 'left'}</span>
                  </span>
                  <span className="text-slate-500 text-xs mt-0.5">of ${acc.routine_monthly_limit.toFixed(2)} limit</span>
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
              You haven't set your Anchor Pay Date in Settings. Navia is temporarily using the 1st of the month for calculations.
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
          {recentTransactions.length > 0 ? (
            recentTransactions.map((txn, idx) => {
              const accountAlias = accounts?.find(a => a.account_id === txn.source_account_id)?.account_alias || 'Unknown Account';
              return (
                <div key={idx} className="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-200">{txn.category}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{new Date(txn.transaction_date).toLocaleDateString()}</span>
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
              <p className="text-slate-500 font-medium">No transactions this cycle.</p>
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
