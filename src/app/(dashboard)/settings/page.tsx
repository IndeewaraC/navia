'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/client';
import { getPayCycleStatus, isCalendarDate, localCalendarDate } from '@/src/lib/payCycleDates';

type PaymentAccount = {
  account_id: string;
  account_alias: string;
  routine_monthly_limit: number;
};

export default function SettingsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [anchorDate, setAnchorDate] = useState('');
  const [cycleStartDate, setCycleStartDate] = useState('');
  const [configError, setConfigError] = useState('');
  const [configSaved, setConfigSaved] = useState(false);
  
  // Payment Accounts State
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [newAlias, setNewAlias] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [isAddingMode, setIsAddingMode] = useState(false);

  const fetchAccounts = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('payment_accounts')
      .select('account_id, account_alias, routine_monthly_limit')
      .eq('user_id', uid)
      .order('created_at', { ascending: true });

    if (data) setAccounts(data as PaymentAccount[]);
  }, [supabase]);

  useEffect(() => {
    async function loadUserData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email || '');
        
        // Load Anchor Date & Display Name
        const { data: profile } = await supabase
          .from('profiles')
          .select('anchor_pay_date, display_name')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          if (profile.anchor_pay_date) setAnchorDate(profile.anchor_pay_date);
          if (profile.display_name) setDisplayName(profile.display_name);
        }
        setCycleStartDate(getPayCycleStatus(profile?.anchor_pay_date, new Date(), user.user_metadata?.navia_budget_cycle_start).cycle_start);

        // Load Payment Accounts
        fetchAccounts(user.id);
      }
    }
    loadUserData();
  }, [supabase, fetchAccounts]);

  const handleSaveConfig = async () => {
    if (!userId) return;
    setConfigError('');
    setConfigSaved(false);
    if (!isCalendarDate(anchorDate)) {
      setConfigError('Choose a valid reset date.');
      return;
    }
    if (!isCalendarDate(cycleStartDate) || cycleStartDate > localCalendarDate()) {
      setConfigError('Choose today or a past date for the current cycle start.');
      return;
    }
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user || user.id !== userId) throw new Error('Please sign in again to save your reset date.');

      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles').select('anchor_pay_date').eq('id', userId).maybeSingle();
      if (profileError) throw new Error('Unable to load your current reset date.');
      const currentCycle = getPayCycleStatus(currentProfile?.anchor_pay_date, new Date(), user.user_metadata?.navia_budget_cycle_start);
      // A past anchor establishes the current cycle. A future anchor schedules
      // the next reset while retaining the independently chosen current start.
      const nextStart = anchorDate <= localCalendarDate() ? anchorDate : cycleStartDate;
      const { error: cycleError } = await supabase.auth.updateUser({
        data: { navia_budget_cycle_start: nextStart },
      });
      if (cycleError) throw new Error('Unable to preserve your current spending. Reset date was not changed.');

      const { error: saveError } = await supabase.from('profiles').upsert({
        id: userId, anchor_pay_date: anchorDate, display_name: displayName,
        username: userEmail.split('@')[0],
      });
      if (saveError) {
        const { error: restoreError } = await supabase.auth.updateUser({
          data: { navia_budget_cycle_start: currentCycle.cycle_start },
        });
        if (restoreError) throw new Error('Configuration could not be saved or the prior cycle start restored. Reload Settings and check the current cycle start.');
        throw new Error('Unable to save configuration. Your current cycle was kept. Please try again.');
      }
      setCycleStartDate(nextStart);
      setConfigSaved(true);
      router.refresh();
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : 'Unable to save configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async () => {
    if (!userId || !newAlias || !newLimit) return;
    setLoading(true);
    
    const { error } = await supabase.from('payment_accounts').insert({
      user_id: userId,
      account_alias: newAlias,
      routine_monthly_limit: Number(newLimit),
      current_statement_balance: 0, // Default starting balance
      account_type: 'CREDIT' // Defaulting to credit, can be expanded later
    });

    if (!error) {
      setNewAlias('');
      setNewLimit('');
      setIsAddingMode(false);
      await fetchAccounts(userId);
    }
    setLoading(false);
  };

  const handleUpdateAccount = async (id: string, updatedAlias: string, updatedLimit: number) => {
    await supabase
      .from('payment_accounts')
      .update({ 
        account_alias: updatedAlias,
        routine_monthly_limit: updatedLimit
      })
      .eq('account_id', id);

    // Optimistically update the UI state
    setAccounts(prev => prev.map(acc => 
      acc.account_id === id 
        ? { ...acc, account_alias: updatedAlias, routine_monthly_limit: updatedLimit } 
        : acc
    ));
  };

  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this payment method?')) return;
    setLoading(true);
    const { error } = await supabase
      .from('payment_accounts')
      .delete()
      .eq('account_id', id);
      
    if (!error) {
      setAccounts(prev => prev.filter(acc => acc.account_id !== id));
    } else {
      alert('Failed to delete payment method.');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-32 selection:bg-emerald-500/30">
      
      {/* Header Area */}
      <div className="px-6 pt-12 pb-6 sticky top-0 bg-slate-950/80 backdrop-blur-xl z-30 border-b border-slate-800/50">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
          Settings
        </h1>
        <p className="text-sm font-medium text-slate-400 mt-1">
          {userEmail || 'Loading Profile...'}
        </p>
      </div>

      <div className="px-6 py-6 space-y-8">
        
        {/* Engine Configuration */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl shadow-inner">
              ⚙️
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Engine Configuration</h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Core calculation variables</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Display Name
              </label>
              <input
                type="text"
                placeholder="How should Navia call you?"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors mb-6"
              />

              <label htmlFor="cycle-start-date" className="block text-sm font-bold text-slate-300 mb-2">
                Current Cycle Start Date
              </label>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Spending from this date, including that day, counts toward your budget and funding source limits. Set an earlier date here to include existing transactions.
              </p>
              <input
                type="date"
                id="cycle-start-date"
                value={cycleStartDate}
                max={localCalendarDate()}
                onChange={(e) => {
                  setCycleStartDate(e.target.value);
                  if (anchorDate && anchorDate <= localCalendarDate()) setAnchorDate(e.target.value);
                  setConfigSaved(false); setConfigError('');
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors mb-6"
              />

              <label htmlFor="anchor-pay-date" className="block text-sm font-bold text-slate-300 mb-2">
                Anchor Pay Date
              </label>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Choose the exact date for your next monthly reset. A past date establishes your current cycle start. A future date schedules the next reset at midnight in Winnipeg and keeps the current cycle start above.
              </p>
              <input
                type="date"
                id="anchor-pay-date"
                value={anchorDate}
                onChange={(e) => {
                  setAnchorDate(e.target.value);
                  if (e.target.value && e.target.value <= localCalendarDate()) setCycleStartDate(e.target.value);
                  setConfigSaved(false); setConfigError('');
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors"
              />
            </div>

            <button
              onClick={handleSaveConfig}
              disabled={loading}
              className="w-full flex items-center justify-center rounded-xl bg-slate-800 text-slate-100 font-bold py-3 px-4 hover:bg-slate-700 transition-colors border border-slate-700 hover:border-slate-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Configuration'}
            </button>
            {configError && <p role="alert" className="text-sm text-rose-400">{configError}</p>}
            {configSaved && <p role="status" className="text-sm text-emerald-400">Configuration saved.</p>}
          </div>
        </div>

        {/* Payment Methods Manager */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl shadow-inner">
                💳
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">Payment Methods</h2>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Manage funding sources & limits</p>
              </div>
            </div>
            <button 
              onClick={() => setIsAddingMode(!isAddingMode)}
              className="text-emerald-400 text-sm font-bold hover:text-emerald-300 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
            >
              {isAddingMode ? 'Cancel' : '+ Add'}
            </button>
          </div>

          <div className="space-y-4">
            {accounts.map((acc) => (
              <div key={acc.account_id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 relative pr-12">
                <button 
                  onClick={() => handleDeleteAccount(acc.account_id)}
                  className="absolute top-4 right-4 text-slate-500 hover:text-red-400 transition-colors"
                  title="Delete Account"
                >
                  🗑️
                </button>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Account Alias</label>
                  <input
                    type="text"
                    defaultValue={acc.account_alias}
                    onBlur={(e) => handleUpdateAccount(acc.account_id, e.target.value, acc.routine_monthly_limit)}
                    className="w-full bg-transparent text-slate-100 font-medium focus:outline-none focus:border-b border-emerald-400 pb-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Monthly Limit ($)</label>
                  <input
                    type="number"
                    defaultValue={acc.routine_monthly_limit}
                    onBlur={(e) => handleUpdateAccount(acc.account_id, acc.account_alias, Number(e.target.value))}
                    className="w-full bg-transparent text-slate-300 focus:outline-none focus:border-b border-emerald-400 pb-1"
                  />
                </div>
              </div>
            ))}

            {accounts.length === 0 && !loading && (
              <p className="text-sm text-slate-500 text-center py-4 italic">No payment methods found.</p>
            )}

            {/* Add New Method Form */}
            {isAddingMode && (
              <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-4 mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <h3 className="text-sm font-bold text-emerald-400 mb-2">New Payment Method</h3>
                <div>
                  <input
                    type="text"
                    placeholder="e.g., Amex Gold"
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:border-emerald-400 text-sm"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Monthly Limit (e.g., 2000)"
                    value={newLimit}
                    onChange={(e) => setNewLimit(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:border-emerald-400 text-sm"
                  />
                </div>
                <button
                  onClick={handleAddAccount}
                  disabled={loading || !newAlias || !newLimit}
                  className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors mt-2 disabled:opacity-50"
                >
                  Save New Method
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Security / Logout */}
        <div className="pt-8">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold py-4 px-4 hover:bg-red-500/20 hover:border-red-500/30 transition-all active:scale-95"
          >
            <span className="text-xl">🔒</span> Securely Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}
