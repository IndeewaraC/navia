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

function fixture({ anchor = '2026-11-14', authenticated = true, profileError = false, spendError = false, metadataError = false } = {}) {
  const user = { id: userId, user_metadata: {} };
  const tables = {
    profiles: [{ id: userId, anchor_pay_date: anchor, display_name: 'Regression' }],
    payment_accounts: [{ account_id: accountId, user_id: userId, account_alias: 'Test card', routine_monthly_limit: 100 }],
    exempt_projects: [],
    transactions: [
      txn('2026-10-13', 500), txn('2026-10-14', 12.70), txn('2026-10-20', 57.30),
      txn('2026-10-20', 25, { is_budget_cap_exempt: true }), txn('2026-11-14', 5),
      txn('2026-10-20', 800, { user_id: 'another-user' }),
      txn('2026-10-20', 100, { txn_type: 'INCOME' }),
    ],
  };
  const queries = [], writes = [];
  database = {
    tables, queries, writes, user,
    auth: {
      getUser: async () => ({ data: { user: authenticated ? user : null }, error: null }),
      updateUser: async ({ data }) => {
        if (metadataError) return { error: { message: 'Fixture preference failure' } };
        Object.assign(user.user_metadata, data);
        return { data: { user }, error: null };
      },
    },
    rpc() { throw new Error('Budget flow must not depend on the old UTC database RPC'); },
    from(table) {
      const query = { table, filters: [], offset: 0, limit: Infinity, insert: null };
      const builder = {
        select() { return this; },
        eq(key, value) { query.filters.push([key, value, (a, b) => a === b]); return this; },
        gte(key, value) { query.filters.push([key, value, (a, b) => a >= b]); return this; },
        lte(key, value) { query.filters.push([key, value, (a, b) => a <= b]); return this; },
        lt(key, value) { query.filters.push([key, value, (a, b) => a < b]); return this; },
        order() { return this; },
        limit(n) { query.limit = n; return this; },
        range(from, to) { query.offset = from; query.limit = to - from + 1; return this; },
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
        const rows = tables[table].filter(row => query.filters.every(([key, value, compare]) => compare(row[key], value))).slice(query.offset, query.offset + query.limit);
        return { data: single ? rows[0] || null : rows, error: null };
      }
      return builder;
    },
  };
  return database;
}

function expense(amount = 15, date = '2026-10-20') {
  return new Request('http://localhost/api/transactions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_account_id: accountId, txn_type: 'EXPENSE', amount,
      transaction_date: date, category: 'Boundary test', is_budget_cap_exempt: false }),
  });
}

test('screenshot flow keeps October 14 spend until November 14 and preserves history after reset', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-21T02:00:00Z') });
  const db = fixture();
  let html = renderToStaticMarkup(await DashboardPage());
  assert.match(html, /\$70\.00/);
  assert.match(html, /\$30\.00/);
  assert.match(html, /Next reset: 2026-11-14 at midnight \(Winnipeg\)/);
  assert.doesNotMatch(html, /Magic Month Detected/);
  assert.equal(db.user.user_metadata.navia_budget_cycle_start, '2026-10-14');

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

  for (const instant of ['2026-10-31T18:00:00Z', '2026-11-01T18:00:00Z', '2026-11-14T05:59:59.999Z']) {
    t.mock.timers.setTime(Date.parse(instant));
    assert.match(renderToStaticMarkup(await DashboardPage()), /\$85\.00/);
  }
  assert.match(renderToStaticMarkup(await DashboardPage()), /\$85\.00/);
  t.mock.timers.setTime(Date.parse('2026-11-14T06:00:00Z'));
  html = renderToStaticMarkup(await DashboardPage());
  assert.match(html, /\$5\.00/);
  assert.match(html, /\$95\.00/);
  assert.match(html, /Choose your next reset date in Settings/);
  assert.equal(db.tables.transactions.length, 8);
  assert.equal(db.writes.length, 1, 'Rendering and rollover must never rewrite or delete transactions');
  const paydayResponse = await POST(expense(10, '2026-11-14'));
  assert.equal((await paydayResponse.json()).threshold_alert, null);
});

test('100% alert uses the same manually configured window as the dashboard', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-21T02:00:00Z') });
  fixture();
  const response = await POST(expense(30));
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.threshold_alert.level, 'BREACH');
  assert.equal(body.threshold_alert.current_spend, 100);
});

test('backdated and future expenses do not change active-cycle alerts', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-21T02:00:00Z') });
  fixture();
  for (const date of ['2026-10-13', '2026-11-14']) {
    const response = await POST(expense(500, date));
    assert.equal(response.status, 201);
    assert.equal((await response.json()).threshold_alert, null);
  }
  assert.match(renderToStaticMarkup(await DashboardPage()), /\$70\.00/);
});

test('users without an anchor can log expenses and keep their start over a calendar month boundary', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-21T02:00:00Z') });
  fixture({ anchor: null });
  assert.match(renderToStaticMarkup(await DashboardPage()), /Pay Cycle Not Aligned/);
  assert.equal((await POST(expense())).status, 201);
  t.mock.timers.setTime(Date.parse('2026-11-02T18:00:00Z'));
  assert.match(renderToStaticMarkup(await DashboardPage()), /Current cycle started: 2026-10-01/);
});

test('authentication and failed profile/spending reads cannot become false zero balances or writes', async () => {
  let db = fixture({ authenticated: false });
  assert.equal((await POST(expense())).status, 401);
  assert.equal(db.writes.length, 0);
  for (const options of [{ profileError: true }, { spendError: true }, { metadataError: true }]) {
    db = fixture(options);
    assert.equal((await POST(expense())).status, 500);
    await assert.rejects(DashboardPage(), /Unable to (load|preserve)/);
    assert.equal(db.writes.length, 0);
  }
});

test('rescheduling a future reset cannot hide existing spending or move the start', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-21T02:00:00Z') });
  const db = fixture();
  await DashboardPage(); // Persist the initial monthly cycle once.
  db.tables.profiles[0].anchor_pay_date = '2026-12-05';
  let html = renderToStaticMarkup(await DashboardPage());
  assert.match(html, /\$70\.00/);
  assert.match(html, /Current cycle started: 2026-10-14/);
  assert.match(html, /Next reset: 2026-12-05/);
  t.mock.timers.setTime(Date.parse('2026-11-15T18:00:00Z'));
  html = renderToStaticMarkup(await DashboardPage());
  assert.match(html, /\$75\.00/); // Includes the November 14 expense; no reset then.
  assert.match(html, /Next reset: 2026-12-05/);
});

test('the provided $12.70 expense is included with a November 14 reset and $800 of limits', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-21T02:00:00Z') });
  const db = fixture();
  db.tables.transactions = [txn('2026-10-14', 12.70)];
  db.tables.payment_accounts = [
    { account_id: accountId, user_id: userId, account_alias: 'VisaCibc', routine_monthly_limit: 300 },
    { account_id: 'other-card', user_id: userId, account_alias: 'MasterCard-Costco', routine_monthly_limit: 500 },
  ];
  const html = renderToStaticMarkup(await DashboardPage());
  assert.match(html, /\$12\.70/);
  assert.match(html, /\$800\.00/);
  assert.match(html, /\$287\.30/);
  assert.match(html, /Next reset: 2026-11-14/);
  assert.doesNotMatch(html, /Next reset: 2026-10-31|Magic Month Detected/);
  assert.equal(db.writes.length, 0);
});

test('a far-future reset bootstraps a stable start that survives the first of the next month', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-21T02:00:00Z') });
  const db = fixture({ anchor: '2027-02-28' });
  await DashboardPage();
  const start = db.user.user_metadata.navia_budget_cycle_start;
  t.mock.timers.setTime(Date.parse('2026-11-02T18:00:00Z'));
  await DashboardPage();
  assert.equal(db.user.user_metadata.navia_budget_cycle_start, start);
});

test('October 2 anchors spending, each funding balance, and API alerts despite a later saved start', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-21T02:00:00Z') });
  const db = fixture({ anchor: '2026-10-02' });
  const masterCard = '00000000-0000-4000-8000-000000000003';
  db.user.user_metadata.navia_budget_cycle_start = '2026-10-14';
  db.tables.payment_accounts = [
    { account_id: accountId, user_id: userId, account_alias: 'VisaCibc', routine_monthly_limit: 300 },
    { account_id: masterCard, user_id: userId, account_alias: 'MasterCard-Costco', routine_monthly_limit: 500 },
  ];
  db.tables.transactions = [
    txn('2026-10-01', 999), txn('2026-10-02', 40), txn('2026-10-09', 12.70),
    txn('2026-10-02', 75, { source_account_id: masterCard }),
    txn('2026-10-20', 25, { source_account_id: masterCard }),
    txn('2026-10-20', 15, { is_budget_cap_exempt: true }),
    txn('2026-10-20', 500, { txn_type: 'INCOME' }),
    txn('2026-10-20', 1000, { user_id: 'another-user' }), txn('2026-10-21', 60),
  ];
  let html = renderToStaticMarkup(await DashboardPage());
  assert.match(html, /Current cycle started: 2026-10-02/);
  assert.match(html, /\$152\.70/);
  assert.match(html, /\$247\.30/);
  assert.match(html, /\$400\.00/);
  const text = html.replace(/<[^>]+>/g, ' ');
  assert.match(text, /Operational spent\s+\$52\.70/);
  assert.match(text, /Operational spent\s+\$100\.00/);
  assert.match(text, /Exempt spent\s+\$15\.00/);
  assert.match(html, /\$167\.70/);
  assert.equal(db.user.user_metadata.navia_budget_cycle_start, '2026-10-02');
  const response = await POST(expense(200));
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.threshold_alert.level, 'WARNING');
  assert.equal(body.threshold_alert.current_spend, 252.70);
  html = renderToStaticMarkup(await DashboardPage());
  assert.match(html, /\$352\.70/);
  assert.match(html, /\$47\.30/);
  assert.match(html, /\$400\.00/);
  assert.equal(db.writes.length, 1, 'Recalculation does not rewrite historical transactions');
});
