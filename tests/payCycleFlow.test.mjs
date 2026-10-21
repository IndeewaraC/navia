import tsNode from 'ts-node';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

tsNode.register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS', moduleResolution: 'node', jsx: 'react-jsx' },
});
const require = createRequire(import.meta.url);
let database;
const originalLoad = Module._load;
// Load the real page and route, substituting only their external service and
// navigation boundaries. No live account, database or financial data is used.
Module._load = function (id, parent, isMain) {
  if (id === '@/src/lib/supabase/server' || id === '@/src/lib/supabase/client') {
    return { createClient: () => database };
  }
  if (id === 'next/navigation') return { useRouter: () => ({ refresh() {}, push() {} }) };
  if (id.startsWith('@/')) id = path.resolve(id.slice(2));
  return originalLoad.call(this, id, parent, isMain);
};
let POST, DashboardPage;
try {
  ({ POST } = require('../src/app/api/transactions/route.ts'));
  DashboardPage = require('../src/app/(dashboard)/ledger/page.tsx').default;
} finally {
  Module._load = originalLoad;
}

const userId = '00000000-0000-4000-8000-000000000001';
const accountId = '00000000-0000-4000-8000-000000000002';
const txn = (date, amount, extra = {}) => ({
  transaction_id: `fixture-${date}-${amount}`, user_id: userId, source_account_id: accountId,
  transaction_date: date, amount, category: 'Test expense', txn_type: 'EXPENSE',
  is_budget_cap_exempt: false, created_at: `${date}T12:00:00Z`, ...extra,
});

function fixture({ anchor = '2026-10-09', authenticated = true, profileError = false, spendError = false } = {}) {
  const tables = {
    profiles: [{ id: userId, anchor_pay_date: anchor, display_name: 'Regression' }],
    payment_accounts: [{ account_id: accountId, user_id: userId, account_alias: 'Test card', routine_monthly_limit: 100 }],
    exempt_projects: [],
    transactions: [
      txn('2026-10-08', 500), txn('2026-10-10', 60), txn('2026-10-22', 10),
      txn('2026-10-22', 25, { is_budget_cap_exempt: true }), txn('2026-10-23', 5),
      txn('2026-10-22', 800, { user_id: 'another-user' }),
      txn('2026-10-22', 100, { txn_type: 'INCOME' }),
    ],
  };
  const queries = [], writes = [];
  database = {
    tables, queries, writes,
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: userId } : null }, error: null }) },
    rpc() { throw new Error('Budget flow must not depend on the old UTC database RPC'); },
    from(table) {
      const query = { table, filters: [], limit: Infinity, insert: null };
      const builder = {
        select() { return this; },
        eq(key, value) { query.filters.push([key, value, (a, b) => a === b]); return this; },
        gte(key, value) { query.filters.push([key, value, (a, b) => a >= b]); return this; },
        lte(key, value) { query.filters.push([key, value, (a, b) => a <= b]); return this; },
        order() { return this; },
        limit(n) { query.limit = n; return this; },
        insert(value) { query.insert = value; return this; },
        single() { return Promise.resolve(result(true)); },
        maybeSingle() { return Promise.resolve(result(true)); },
        then(resolve, reject) { return Promise.resolve(result(false)).then(resolve, reject); },
      };
      function result(single) {
        queries.push(query);
        if ((table === 'profiles' && profileError) || (table === 'transactions' && !query.insert && spendError)) {
          return { data: null, error: { message: 'Fixture service failure' } };
        }
        if (query.insert) {
          const row = { ...query.insert, transaction_id: `new-${writes.length}` };
          tables[table].push(row); writes.push(row);
          return { data: single ? row : [row], error: null };
        }
        const rows = tables[table].filter(row => query.filters.every(([key, value, compare]) => compare(row[key], value))).slice(0, query.limit);
        return { data: single ? rows[0] || null : rows, error: null };
      }
      return builder;
    },
  };
  return database;
}

function expense(amount = 15, date = '2026-10-22') {
  return new Request('http://localhost/api/transactions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_account_id: accountId, txn_type: 'EXPENSE', amount,
      transaction_date: date, category: 'Boundary test', is_budget_cap_exempt: false }),
  });
}

test('expense → alert → dashboard preserves totals until local payday and keeps history after rollover', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-23T02:00:00Z') });
  const db = fixture();
  let html = renderToStaticMarkup(await DashboardPage());
  assert.match(html, /\$70\.00/);
  assert.match(html, /\$30\.00/);
  assert.match(html, /Next reset: 2026-10-23 at midnight \(Winnipeg\)/);

  const response = await POST(expense());
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.threshold_alert.level, 'WARNING');
  assert.equal(saved.threshold_alert.current_spend, 85);
  html = renderToStaticMarkup(await DashboardPage());
  assert.match(html, /\$85\.00/);
  assert.match(html, /\$15\.00/);
  // Tenant and date filters are exercised against real stored fixture rows.
  const windowQueries = db.queries.filter(q => q.table === 'transactions' && q.filters.some(([key]) => key === 'transaction_date'));
  assert.ok(windowQueries.every(q => q.filters.some(([key, value]) => key === 'user_id' && value === userId)));

  t.mock.timers.setTime(Date.parse('2026-10-23T04:59:59.999Z'));
  assert.match(renderToStaticMarkup(await DashboardPage()), /\$85\.00/);
  t.mock.timers.setTime(Date.parse('2026-10-23T05:00:00Z'));
  html = renderToStaticMarkup(await DashboardPage());
  assert.match(html, /\$5\.00/);
  assert.match(html, /\$95\.00/);
  assert.match(html, /Next reset: 2026-11-06/);
  assert.equal(db.tables.transactions.length, 8);
  assert.equal(db.writes.length, 1, 'Rendering and rollover must never rewrite or delete transactions');
  const paydayResponse = await POST(expense(10, '2026-10-23'));
  assert.equal((await paydayResponse.json()).threshold_alert, null);
});

test('100% alert uses the same 14-day window as the dashboard', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-23T02:00:00Z') });
  fixture();
  const response = await POST(expense(30));
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.threshold_alert.level, 'BREACH');
  assert.equal(body.threshold_alert.current_spend, 100);
});

test('backdated and future expenses do not change active-cycle alerts', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-23T02:00:00Z') });
  fixture();
  for (const date of ['2026-10-08', '2026-10-23']) {
    const response = await POST(expense(500, date));
    assert.equal(response.status, 201);
    assert.equal((await response.json()).threshold_alert, null);
  }
  assert.match(renderToStaticMarkup(await DashboardPage()), /\$70\.00/);
});

test('users without an anchor retain the calendar-month fallback and can log expenses', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-23T02:00:00Z') });
  fixture({ anchor: null });
  assert.match(renderToStaticMarkup(await DashboardPage()), /Pay Cycle Not Aligned/);
  assert.equal((await POST(expense())).status, 201);
});

test('authentication and failed profile/spending reads cannot become false zero balances or writes', async () => {
  let db = fixture({ authenticated: false });
  assert.equal((await POST(expense())).status, 401);
  assert.equal(db.writes.length, 0);
  for (const options of [{ profileError: true }, { spendError: true }]) {
    db = fixture(options);
    assert.equal((await POST(expense())).status, 500);
    await assert.rejects(DashboardPage(), /Unable to load/);
    assert.equal(db.writes.length, 0);
  }
});
