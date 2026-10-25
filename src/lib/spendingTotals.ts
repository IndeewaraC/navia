type Expense = {
  amount: number | string;
  txn_type: string;
  source_account_id: string | null;
  is_budget_cap_exempt?: boolean | null;
};

export type SpendingTotals = { operational: number; exempt: number; total: number };
const emptyTotals = (): SpendingTotals => ({ operational: 0, exempt: 0, total: 0 });

export function calculateSpendingTotals(transactions: Expense[]) {
  const overall = emptyTotals();
  const perAccount = new Map<string, SpendingTotals>();
  for (const transaction of transactions) {
    if (transaction.txn_type !== 'EXPENSE') continue;
    const cents = Math.round((Number(transaction.amount) + Number.EPSILON) * 100);
    if (!Number.isFinite(cents)) throw new Error('An expense has an invalid amount.');
    const accountKey = transaction.source_account_id || 'unassigned';
    const account = perAccount.get(accountKey) || emptyTotals();
    const type = transaction.is_budget_cap_exempt ? 'exempt' : 'operational';
    overall[type] += cents;
    overall.total += cents;
    account[type] += cents;
    account.total += cents;
    perAccount.set(accountKey, account);
  }
  const dollars = (totals: SpendingTotals): SpendingTotals => ({
    operational: totals.operational / 100, exempt: totals.exempt / 100, total: totals.total / 100,
  });
  return { ...dollars(overall), perAccount: new Map(Array.from(perAccount, ([id, totals]) => [id, dollars(totals)])) };
}
