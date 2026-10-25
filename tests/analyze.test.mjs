import tsNode from 'ts-node';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

tsNode.register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS', moduleResolution: 'node' },
});
const loadTypeScript = createRequire(import.meta.url);
const {
  currentMonthRange, dateRangeError, fetchSpendingTransactions, searchDescriptions, summarizeSpending,
} = loadTypeScript('../src/lib/analyze.ts');

const range = { startDate: '2030-10-01', endDate: '2030-10-31' };
const accounts = [
  { account_id: 'visa', account_alias: 'Visa' },
  { account_id: 'cash', account_alias: 'Cash' },
  { account_id: 'unused', account_alias: 'Savings' },
];
const expense = (id, amount, category, account = 'visa', date = '2030-10-15', extra = {}) => ({
  transaction_id: String(id), amount, category, source_account_id: account,
  txn_type: 'EXPENSE', transaction_date: date, user_id: 'my-user', ...extra,
});

test('payment totals include exempt expenses, both boundary dates and unused methods, excluding other dates and transaction types', () => {
  const summary = summarizeSpending([
    expense(1, '10.10', 'Coffee', 'visa', range.startDate),
    expense(2, '20.20', 'coffee', 'cash', range.endDate, { is_budget_cap_exempt: true }),
    expense(3, 40, 'Market'),
    expense(4, 500, 'Income', 'cash', '2030-10-15', { txn_type: 'INCOME' }),
    expense(5, 300, 'Vault', 'visa', '2030-10-15', { txn_type: 'TRANSFER' }),
    expense(6, 100, 'Before', 'visa', '2030-09-30'),
    expense(7, 100, 'After', 'visa', '2030-11-01'),
  ], accounts, range);
  assert.equal(summary.total, 70.3);
  assert.equal(summary.count, 3);
  assert.deepEqual(summary.paymentMethods, [
    { key: 'visa', name: 'Visa', total: 50.1, count: 2 },
    { key: 'cash', name: 'Cash', total: 20.2, count: 1 },
    { key: 'unused', name: 'Savings', total: 0, count: 0 },
  ]);
});

test('merchant search combines repeated names across methods and normalizes capitalization and whitespace', () => {
  const summary = summarizeSpending([
    expense(1, 0.1, ' Coffee   Shop '),
    expense(2, 0.2, 'COFFEE shop', 'cash'),
    expense(3, 5, 'Coffee beans'),
    expense(4, 8, 'Market'),
  ], accounts, range);
  assert.deepEqual(searchDescriptions(summary.descriptions, '  coffee   SHOP '), {
    matches: [{ key: 'coffee shop', name: 'Coffee Shop', total: 0.3, count: 2 }],
    total: 0.3, count: 2,
  });
  assert.equal(searchDescriptions(summary.descriptions, 'coffee').total, 5.3);
  assert.equal(searchDescriptions(summary.descriptions, 'coffee').count, 3);
  assert.equal(searchDescriptions(summary.descriptions, '').total, summary.total);
  assert.deepEqual(searchDescriptions(summary.descriptions, 'no match'), { matches: [], total: 0, count: 0 });
});

test('unavailable accounts and empty descriptions still contribute to spending', () => {
  const summary = summarizeSpending([
    expense(1, 5, null, 'deleted-account'), expense(2, 3, '   ', null),
  ], accounts, range);
  assert.equal(summary.total, 8);
  assert.equal(summary.paymentMethods.reduce((sum, method) => sum + method.total, 0), 8);
  assert.deepEqual(summary.descriptions, [{ key: 'no description', name: 'No description', total: 8, count: 2 }]);
  assert.equal(summarizeSpending([], accounts, range).total, 0);
});

test('calendar dates are validated and same-day time frames are allowed', () => {
  assert.equal(dateRangeError(range), '');
  assert.equal(dateRangeError({ startDate: '2032-02-29', endDate: '2032-02-29' }), '');
  for (const startDate of ['', '2030-02-29', '2030-04-31', '2030-13-01', 'not-a-date']) {
    assert.ok(dateRangeError({ startDate, endDate: range.endDate }));
  }
  assert.ok(dateRangeError({ startDate: range.endDate, endDate: range.startDate }));
  assert.deepEqual(currentMonthRange(new Date(2030, 0, 1)), { startDate: '2030-01-01', endDate: '2030-01-01' });
});

function databaseFixture(rows, failAtOffset) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.equal(table, 'transactions');
      const filters = [];
      let offset = 0;
      let end = 0;
      const query = {
        select() { return query; },
        eq(field, value) { filters.push(row => row[field] === value); return query; },
        gte(field, value) { filters.push(row => row[field] >= value); return query; },
        lt(field, value) { filters.push(row => row[field] < value); return query; },
        order() { return query; },
        range(from, to) { offset = from; end = to; calls.push([from, to]); return query; },
        then(resolve, reject) {
          return Promise.resolve(offset === failAtOffset
            ? { data: null, error: new Error('Database unavailable') }
            : { data: rows.filter(row => filters.every(filter => filter(row))).slice(offset, end + 1), error: null }
          ).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

test('loading more than 1,000 expenses preserves full totals and scopes records to the user and inclusive date range', async () => {
  const rows = Array.from({ length: 1205 }, (_, id) => expense(id, '0.10', 'Coffee'));
  rows.push(
    expense('end', '0.25', 'Coffee', 'visa', '2030-10-31T23:59:59.999Z'),
    expense('other-user', 999, 'Coffee', 'visa', range.startDate, { user_id: 'someone-else' }),
    expense('before', 999, 'Coffee', 'visa', '2030-09-30'),
    expense('after', 999, 'Coffee', 'visa', '2030-11-01'),
    expense('income', 999, 'Coffee', 'visa', range.startDate, { txn_type: 'INCOME' }),
  );
  const database = databaseFixture(rows);
  const result = await fetchSpendingTransactions(database, 'my-user', range);
  assert.equal(result.length, 1206);
  assert.equal(summarizeSpending(result, accounts, range).total, 120.75);
  assert.deepEqual(database.calls, [[0, 499], [500, 999], [1000, 1499]]);
});

test('a failure on a later page rejects incomplete totals', async () => {
  const database = databaseFixture(Array.from({ length: 501 }, (_, id) => expense(id, 1, 'Coffee')), 500);
  await assert.rejects(fetchSpendingTransactions(database, 'my-user', range), /Database unavailable/);
  await assert.rejects(fetchSpendingTransactions(database, 'my-user', { ...range, startDate: '' }), /valid start and end/);
});
