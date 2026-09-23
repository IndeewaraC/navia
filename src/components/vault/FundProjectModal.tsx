'use client';

import { useState } from 'react';

interface Project {
  project_id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  icon: string;
}

interface FundProjectModalProps {
  project: Project;
  checkingAccount: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FundProjectModal({ project, checkingAccount, onClose, onSuccess }: FundProjectModalProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const checkingBalance = checkingAccount?.current_statement_balance || 0;
  const remainingNeeded = Math.max(0, project.target_amount - project.saved_amount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fundAmount = parseFloat(amount);
    
    if (isNaN(fundAmount) || fundAmount <= 0) {
      setError('Amount must be greater than zero.');
      setLoading(false);
      return;
    }

    if (fundAmount > checkingBalance) {
      setError(`Insufficient funds in Checking. You only have $${checkingBalance.toFixed(2)} available.`);
      setLoading(false);
      return;
    }

    if (!checkingAccount?.account_id) {
      setError('No checking account found to fund from.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/vault/fund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.project_id,
          source_account_id: checkingAccount.account_id,
          amount: fundAmount
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fund project');

      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-0 -mt-8 -ml-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
        
        <h2 className="text-xl font-bold text-slate-100 mb-2 relative z-10">
          Fund Project
        </h2>
        <p className="text-sm text-slate-400 mb-6 relative z-10">
          Transfer money from Primary Checking into the Vault for <span className="font-bold text-slate-200">{project.icon} {project.name}</span>.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium relative z-10">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Available in Checking:</span>
              <span className="font-bold text-emerald-400">${checkingBalance.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Remaining needed for goal:</span>
              <span className="font-bold text-indigo-400">${remainingNeeded.toFixed(2)}</span>
            </div>
            
            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Transfer Amount ($)</label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-slate-500 font-bold">$</span>
                <input 
                  type="number" 
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors text-lg font-bold"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-400 bg-slate-950 border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition-colors disabled:opacity-50"
            >
              {loading ? 'Transferring...' : 'Transfer Funds'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
