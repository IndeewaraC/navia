'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface QuickExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string; // Passed down from the selected account card
}

export default function QuickExpenseModal({ isOpen, onClose, accountId }: QuickExpenseModalProps) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [paymentSource, setPaymentSource] = useState<'CREDIT' | 'DEBIT' | 'CASH'>('CREDIT');
  const [isExempt, setIsExempt] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState<{ level: string; message: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setWarning(null);

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_account_id: accountId,
          txn_type: 'EXPENSE',
          amount: parseFloat(amount),
          transaction_date: new Date().toISOString().split('T')[0],
          category,
          is_budget_cap_exempt: isExempt,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to log expense');

      // Check for Navia Dual-Layer alerts (80% or 100% operational breach)
      if (data.threshold_alert) {
        setWarning(data.threshold_alert);
        // Do not immediately close the modal so the user sees the warning
        setTimeout(() => {
          onClose();
          router.refresh();
        }, 3000);
      } else {
        onClose();
        router.refresh();
      }

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm font-sans text-slate-100 selection:bg-emerald-500/30">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden transform transition-all">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800/50">
          <h2 className="text-xl font-bold tracking-tight text-slate-100">Log Expense</h2>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Amount Input */}
          <div className="space-y-2 group">
            <label className="block text-sm font-semibold text-slate-300 transition-colors group-focus-within:text-emerald-400">
              Amount
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-slate-400 text-xl font-bold">$</span>
              </div>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Description/Category */}
          <div className="space-y-2 group">
            <label className="block text-sm font-semibold text-slate-300 transition-colors group-focus-within:text-emerald-400">
              Description
            </label>
            <input
              type="text"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="e.g. DoorDash Karachi Darbar, Mitsubishi RVR Fuel..."
            />
          </div>

          {/* 3-Tier Payment Selector */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-300">
              Funding Source
            </label>
            <div className="grid grid-cols-3 gap-3">
              {['CREDIT', 'DEBIT', 'CASH'].map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setPaymentSource(source as 'CREDIT' | 'DEBIT' | 'CASH')}
                  disabled={loading}
                  className={`py-3 rounded-lg font-bold text-sm transition-colors border ${
                    paymentSource === source
                      ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {source}
                </button>
              ))}
            </div>
          </div>

          {/* Dual-Layer Exemption Toggle */}
          <div className="flex items-start space-x-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center h-6">
              <input
                id="exempt"
                type="checkbox"
                checked={isExempt}
                onChange={(e) => setIsExempt(e.target.checked)}
                disabled={loading}
                className="w-5 h-5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 bg-slate-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="exempt" className="text-sm font-semibold text-slate-200 cursor-pointer">
                Exempt from Daily Cap
              </label>
              <p className="text-xs text-slate-400 mt-1">
                Tag as a medical or trip expense.
              </p>
            </div>
          </div>

          {/* Dynamic Alerts */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium flex items-start space-x-3">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>{error}</p>
            </div>
          )}
          
          {warning && (
            <div className={`p-4 rounded-xl border font-medium text-sm flex items-start space-x-3 ${
              warning.level === 'BREACH' 
                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              <span className="text-lg shrink-0">⚠️</span>
              <p className="mt-0.5">{warning.message}</p>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading || !!warning}
            className="w-full flex items-center justify-center rounded-xl bg-emerald-500 text-slate-950 font-bold py-4 px-4 hover:bg-emerald-400 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:shadow-[0_0_25px_rgba(16,185,129,0.2)]"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Routing...
              </>
            ) : (
              'Log Expense'
            )}
          </button>

        </form>
      </div>
    </div>
  );
}
