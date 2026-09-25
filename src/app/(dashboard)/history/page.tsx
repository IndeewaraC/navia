'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/src/lib/supabase/client';

type Transaction = {
  transaction_id: string;
  amount: number;
  category: string;
  txn_type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  is_budget_cap_exempt: boolean;
  transaction_date: string;
  source_account_id: string;
};

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const supabase = createClient();

  useEffect(() => {
    async function fetchTransactions() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false });

      if (data) {
        setTransactions(data);
      }
      setLoading(false);
    }
    
    fetchTransactions();
  }, [supabase]);

  const filteredTransactions = transactions.filter(txn => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const matchesCategory = txn.category.toLowerCase().includes(query);
    const matchesAmount = txn.amount.toString().includes(query);
    const matchesAccount = txn.source_account_id.toLowerCase().includes(query);
    
    return matchesCategory || matchesAmount || matchesAccount;
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Transaction History</h1>
        <p className="text-slate-400 text-sm">Search and review your complete ledger history.</p>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-slate-500">🔍</span>
        </div>
        <input
          type="text"
          placeholder="Search by store, category, or amount..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-inner"
        />
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8 text-center text-slate-500 animate-pulse">Loading ledger data...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {searchQuery ? 'No transactions found matching your search.' : 'Your ledger is empty.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {filteredTransactions.map((txn) => (
              <div key={txn.transaction_id} className="p-4 hover:bg-slate-800/50 transition-colors flex items-center justify-between group">
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-200">{txn.category}</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-slate-500">
                      {new Date(txn.transaction_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wider">
                      {txn.source_account_id}
                    </span>
                    {txn.is_budget_cap_exempt && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider">
                        Exempt
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col items-end">
                  <span className={`font-bold text-lg tracking-tight ${txn.txn_type === 'EXPENSE' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {txn.txn_type === 'EXPENSE' ? '-' : '+'}${Math.abs(txn.amount).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
