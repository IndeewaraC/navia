import tsNode from 'ts-node';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

tsNode.register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const load = createRequire(import.meta.url);
const { calculateSpendingTotals } = load('../src/lib/spendingTotals.ts');

test('Costco medical spending contributes to its exempt and combined totals without reducing its operational allowance', () => {
  const expense = (amount, account, exempt = false, txn_type = 'EXPENSE') => ({
    amount, source_account_id: account, is_budget_cap_exempt: exempt, txn_type,
  });
  const summary = calculateSpendingTotals([
    expense('100.10', 'costco'), expense('25.25', 'costco', true),
    expense('5.05', 'costco', true), expense('10.20', 'cash'),
    expense(900, 'costco', false, 'INCOME'), expense(200, 'costco', false, 'TRANSFER'),
    expense(1, null, true),
  ]);
  assert.deepEqual(summary.perAccount.get('costco'), { operational: 100.1, exempt: 30.3, total: 130.4 });
  assert.deepEqual(summary.perAccount.get('cash'), { operational: 10.2, exempt: 0, total: 10.2 });
  assert.equal(summary.operational, 110.3);
  assert.equal(summary.exempt, 31.3);
  assert.equal(summary.total, 141.6);
});

test('empty spending and decimal sums have exact cent totals', () => {
  assert.deepEqual(calculateSpendingTotals([]), { operational: 0, exempt: 0, total: 0, perAccount: new Map() });
  assert.equal(calculateSpendingTotals([0.1, 0.2].map(amount => ({
    amount, source_account_id: 'costco', txn_type: 'EXPENSE',
  }))).total, 0.3);
});
