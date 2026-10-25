import type { SupabaseClient } from '@supabase/supabase-js';

export type DateRange = { startDate: string; endDate: string };
export type SpendingTransaction = {
  transaction_id: string;
  amount: number | string;
  category: string | null;
  txn_type: string;
  transaction_date: string;
  source_account_id: string | null;
};
export type PaymentAccount = { account_id: string; account_alias: string };
export type SpendingGroup = { key: string; name: string; total: number; count: number };

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function currentMonthRange(now = new Date()): DateRange {
  return {
    startDate: localDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: localDate(now),
  };
}

export function dateRangeError({ startDate, endDate }: DateRange): string {
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!validDate(startDate) || !validDate(endDate)) return 'Choose a valid start and end date.';
  if (startDate > endDate) return 'The end date must be on or after the start date.';
  return '';
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().split('T')[0];
}

// Fetch every page: Supabase's default row limit must not truncate spending totals.
export async function fetchSpendingTransactions(
  supabase: SupabaseClient,
  userId: string,
  range: DateRange,
  signal?: AbortSignal,
): Promise<SpendingTransaction[]> {
  const errorMessage = dateRangeError(range);
  if (errorMessage) throw new Error(errorMessage);
  const transactions: SpendingTransaction[] = [];
  const pageSize = 500;

  for (let offset = 0; ; offset += pageSize) {
    let query = supabase.from('transactions')
      .select('transaction_id, amount, category, txn_type, transaction_date, source_account_id')
      .eq('user_id', userId)
      .eq('txn_type', 'EXPENSE')
      .gte('transaction_date', range.startDate)
      .lt('transaction_date', nextDate(range.endDate))
      .order('transaction_date', { ascending: true })
      .order('transaction_id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    if (!data) throw new Error('Spending data was not returned.');
    transactions.push(...data);
    if (data.length < pageSize) return transactions;
  }
}

export function normalizeDescription(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function summarizeSpending(
  transactions: SpendingTransaction[],
  accounts: PaymentAccount[],
  range: DateRange,
) {
  const paymentMethods = new Map<string, SpendingGroup>(accounts.map(account => [
    account.account_id,
    { key: account.account_id, name: account.account_alias, total: 0, count: 0 },
  ]));
  const descriptions = new Map<string, SpendingGroup>();
  let totalCents = 0;
  let count = 0;

  for (const transaction of transactions) {
    const date = transaction.transaction_date.slice(0, 10);
    if (transaction.txn_type !== 'EXPENSE' || date < range.startDate || date > range.endDate) continue;
    const cents = Math.round((Number(transaction.amount) + Number.EPSILON) * 100);
    if (!Number.isFinite(cents)) throw new Error('An expense has an invalid amount.');
    totalCents += cents;
    count += 1;

    const accountKey = transaction.source_account_id || 'unassigned';
    const account = paymentMethods.get(accountKey) || {
      key: accountKey, name: transaction.source_account_id ? 'Unavailable payment method' : 'Unassigned payment method', total: 0, count: 0,
    };
    account.total += cents;
    account.count += 1;
    paymentMethods.set(accountKey, account);

    // Quick Expense stores the merchant/description in the category column.
    const name = normalizeDescription(transaction.category || '') || 'No description';
    const key = name.toLowerCase();
    const description = descriptions.get(key) || { key, name, total: 0, count: 0 };
    description.total += cents;
    description.count += 1;
    descriptions.set(key, description);
  }

  const sortedGroups = (groups: Map<string, SpendingGroup>) => Array.from(groups.values())
    .map(group => ({ ...group, total: group.total / 100 }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return {
    total: totalCents / 100,
    count,
    paymentMethods: sortedGroups(paymentMethods),
    descriptions: sortedGroups(descriptions),
  };
}

export function searchDescriptions(descriptions: SpendingGroup[], query: string) {
  const search = normalizeDescription(query).toLowerCase();
  const matches = descriptions.filter(description => description.name.toLowerCase().includes(search));
  return {
    matches,
    total: matches.reduce((sum, group) => sum + Math.round(group.total * 100), 0) / 100,
    count: matches.reduce((sum, group) => sum + group.count, 0),
  };
}
