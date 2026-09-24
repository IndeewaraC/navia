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

  // Auto-create a default checking account if the user doesn't have any (for new users)
  if (!accounts || accounts.length === 0) {
    const { data: newAccount } = await supabase
      .from('payment_accounts')
      .insert({
        user_id: user.id,
        account_alias: 'Primary Checking',
        account_type: 'DEBIT',
        current_statement_balance: 5000.00,
        routine_monthly_limit: 1000
      })
      .select('account_id, account_alias, routine_monthly_limit')
      .single();
    
    if (newAccount) {
      accounts = [newAccount];
    }
  }

  // Fetch active projects for the FAB dropdown
  const { data: activeProjects } = await supabase
    .from('exempt_projects')
    .select('project_id, name')
    .eq('user_id', user.id);

  // 2. Fetch Active Cycle Status
  const { data: cycleData } = await supabase.rpc('get_pay_cycle_status', { p_user_id: user.id });

  // 3. Fetch Spend Data for the Current Cycle
  let operationalSpend = 0;
  let exemptSpend = 0;
  let recentTransactions: any[] = [];

  if (cycleData && !cycleData.error) {
    const { data: txns } = await supabase
      .from('transactions')
      .select('amount, category, txn_type, is_budget_cap_exempt, transaction_date')
      .eq('user_id', user.id)
      .gte('transaction_date', cycleData.cycle_start)
      .order('transaction_date', { ascending: false });

    if (txns) {
      recentTransactions = txns.slice(0, 5); // Grab latest 5 for the feed
      
      txns.forEach((txn) => {
        if (txn.txn_type === 'EXPENSE') {
          if (txn.is_budget_cap_exempt) {
            exemptSpend += Number(txn.amount);
          } else {
            operationalSpend += Number(txn.amount);
          }
        }
      });
    }
  }

  // Calculate Dual-Layer Gauge logic
  // Use the sum of all monthly limits
  const limit = (accounts || []).reduce((acc, account) => acc + (account.routine_monthly_limit || 0), 0) || 1000;
  const spendPercentage = Math.min((operationalSpend / limit) * 100, 100);
  
  let progressColor = 'bg-emerald-400';
  if (spendPercentage >= 100) progressColor = 'bg-rose-500';
  else if (spendPercentage >= 80) progressColor = 'bg-amber-400';

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-6 pt-8">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-slate-100">Command Center</h1>
        <p className="text-slate-400 font-medium text-sm">Active Cycle Overview</p>
      </header>

      {/* Dual Layer Gauge */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[40px] rounded-full pointer-events-none" />
        
        <h2 className="text-slate-400 font-semibold mb-2 text-sm uppercase tracking-wider">Operational Spend</h2>
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

      {/* Early Cycle Warning Injection */}
      {cycleData && cycleData.is_magic_month && (accounts || []).length > 0 && (
        <EarlyCycleWarnings userId={user.id} />
      )}

      {/* Recent Feed */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 px-2">Recent Transactions</h2>
        <div className="space-y-3">
          {recentTransactions.length > 0 ? (
            recentTransactions.map((txn, idx) => (
              <div key={idx} className="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-200">{txn.category}</span>
                  <span className="text-xs text-slate-500">{new Date(txn.transaction_date).toLocaleDateString()}</span>
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
            ))
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
