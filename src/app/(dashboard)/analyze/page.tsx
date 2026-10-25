'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createClient } from '@/src/lib/supabase/client';
import {
  currentMonthRange, dateRangeError, fetchSpendingTransactions, searchDescriptions, summarizeSpending,
  type DateRange, type PaymentAccount, type SpendingTransaction,
} from '@/src/lib/analyze';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const expenseCount = (count: number) => `${count} expense${count === 1 ? '' : 's'}`;
const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
});

export default function AnalyzePage() {
  const [supabase] = useState(() => createClient());
  const [range, setRange] = useState<DateRange>(currentMonthRange);
  const [draftRange, setDraftRange] = useState(range);
  const [validationError, setValidationError] = useState('');
  const [search, setSearch] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    range: DateRange;
    attempt: number;
    transactions: SpendingTransaction[];
    accounts: PaymentAccount[];
    error: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error('Sign in again to view your spending.');
        const [transactions, accountsResult] = await Promise.all([
          fetchSpendingTransactions(supabase, user.id, range, controller.signal),
          supabase.from('payment_accounts')
            .select('account_id, account_alias')
            .eq('user_id', user.id)
            .order('account_id', { ascending: true })
            .abortSignal(controller.signal),
        ]);
        if (accountsResult.error) throw accountsResult.error;
        if (!accountsResult.data) throw new Error('Payment methods were not returned.');
        if (!controller.signal.aborted) {
          setResult({ range, attempt, transactions, accounts: accountsResult.data, error: '' });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult({
            range, attempt, transactions: [], accounts: [],
            error: error instanceof Error && error.message === 'Sign in again to view your spending.'
              ? error.message : 'Unable to load your spending. Please try again.',
          });
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [supabase, range, attempt]);

  const loading = !result || result.range !== range || result.attempt !== attempt;
  const summary = useMemo(() => summarizeSpending(
    result?.transactions || [], result?.accounts || [], range,
  ), [result, range]);
  const matching = useMemo(() => searchDescriptions(summary.descriptions, search), [summary, search]);

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = dateRangeError(draftRange);
    setValidationError(error);
    if (!error) {
      setRange({ ...draftRange });
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Analyze</h1>
        <p className="text-sm text-slate-400">See where your money goes across payment methods and merchants.</p>
      </header>

      <form onSubmit={applyRange} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <fieldset>
          <legend className="font-semibold text-slate-200 mb-3">Time frame</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0 space-y-2">
              <label htmlFor="analysis-start" className="block text-sm text-slate-300">Start date</label>
              <input
                id="analysis-start" type="date" required value={draftRange.startDate}
                onChange={event => setDraftRange({ ...draftRange, startDate: event.target.value })}
                aria-invalid={!!validationError} aria-describedby={validationError ? 'analysis-date-error' : undefined}
                className="block w-full min-w-0 max-w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <label htmlFor="analysis-end" className="block text-sm text-slate-300">End date</label>
              <input
                id="analysis-end" type="date" required value={draftRange.endDate}
                onChange={event => setDraftRange({ ...draftRange, endDate: event.target.value })}
                aria-invalid={!!validationError} aria-describedby={validationError ? 'analysis-date-error' : undefined}
                className="block w-full min-w-0 max-w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>
        </fieldset>
        {validationError && <p id="analysis-date-error" role="alert" className="text-sm text-rose-400">{validationError}</p>}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <p className="text-xs text-slate-400">Both dates are included. Includes all expenses, including exempt spending.</p>
          <button type="submit" className="shrink-0 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
            Analyze spending
          </button>
        </div>
      </form>

      {loading ? (
        <p role="status" className="p-8 text-center text-slate-400">Loading spending analysis...</p>
      ) : result.error ? (
        <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 space-y-3">
          <p className="text-sm text-rose-400">{result.error}</p>
          <button type="button" onClick={() => setAttempt(value => value + 1)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">Try again</button>
        </div>
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="period-total-heading" className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 sm:p-6 space-y-2">
            <h2 id="period-total-heading" className="text-sm font-semibold text-slate-300">Total spent</h2>
            <p className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-400 break-all tabular-nums">{money.format(summary.total)}</p>
            <p className="text-sm text-slate-400">{expenseCount(summary.count)} &middot; {formatDate(range.startDate)} &ndash; {formatDate(range.endDate)}</p>
          </section>

          <section aria-labelledby="payment-methods-heading" className="space-y-3">
            <h2 id="payment-methods-heading" className="text-lg font-bold text-slate-200">By payment method</h2>
            <p className="text-sm text-slate-400">Totals for the full time frame.</p>
            {summary.paymentMethods.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-800 p-5 text-sm text-slate-400">No payment methods or expenses in this time frame.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {summary.paymentMethods.map(method => (
                  <li key={method.key} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold text-slate-200 break-words">{method.name}</h3>
                      <p className="text-xs text-slate-400 mt-1">{expenseCount(method.count)}</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-100 break-all tabular-nums">{money.format(method.total)}</p>
                    <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${summary.total > 0 ? Math.min(100, method.total / summary.total * 100) : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="merchant-heading" className="space-y-4">
            <div className="space-y-1">
              <h2 id="merchant-heading" className="text-lg font-bold text-slate-200">By merchant / description</h2>
              <p className="text-sm text-slate-400">Repeated names are combined across payment methods.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="analysis-search" className="block text-sm text-slate-300">Search merchant or description</label>
              <input
                id="analysis-search" type="search" value={search} onChange={event => setSearch(event.target.value)}
                placeholder="e.g. Walmart, coffee, electricity" autoComplete="off"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div role="status" aria-live="polite" className="rounded-xl bg-slate-900 border border-slate-800 px-4 py-3">
              <p className="text-sm text-slate-400">{search.trim() ? 'Matching total' : 'Merchant total'}</p>
              <p className="text-2xl font-bold text-emerald-400 break-all tabular-nums">{money.format(matching.total)}</p>
              <p className="text-xs text-slate-400 mt-1">{expenseCount(matching.count)} across {matching.matches.length} merchant{matching.matches.length === 1 ? '' : 's'} / description{matching.matches.length === 1 ? '' : 's'}</p>
            </div>
            {matching.matches.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-400">
                {summary.count === 0 ? 'No expenses in this time frame. Try a different date range.' : 'No merchants or descriptions match your search.'}
              </p>
            ) : (
              <ul aria-label="Merchant spending" className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                {matching.matches.map(description => (
                  <li key={description.key} className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 basis-36">
                      <h3 className="font-semibold text-slate-200 break-words">{description.name}</h3>
                      <p className="text-xs text-slate-400 mt-1">{expenseCount(description.count)}</p>
                    </div>
                    <p className="max-w-full font-bold text-slate-100 break-all tabular-nums">{money.format(description.total)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
