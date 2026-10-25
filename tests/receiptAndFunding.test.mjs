import tsNode from 'ts-node';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

tsNode.register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node', jsx: 'react-jsx' } });
const require = createRequire(import.meta.url);
let database;
const originalLoad = Module._load;
Module._load = function (id, parent, isMain) {
  if (id === '@/src/lib/supabase/server') return { createClient: () => database };
  if (id === 'next/cache') return { revalidatePath() {} };
  if (id === 'next/navigation') return { useRouter: () => ({ refresh() {} }) };
  if (id.startsWith('@/')) id = path.resolve(id.slice(2));
  return originalLoad.call(this, id, parent, isMain);
};
let fund, receipt, PastReceiptCard, formatCalendarDate;
try {
  fund = require('../src/app/api/vault/fund/route.ts').POST;
  receipt = require('../src/app/api/groceries/receipt/route.ts').POST;
  PastReceiptCard = require('../src/components/groceries/PastReceiptCard.tsx').default;
  ({ formatCalendarDate } = require('../src/lib/calendarDateDisplay.ts'));
} finally { Module._load = originalLoad; }

const userId = '00000000-0000-4000-8000-000000000001';
const projectId = '00000000-0000-4000-8000-000000000002';
const accountId = '00000000-0000-4000-8000-000000000003';

function fixture({ authenticated = true, owner = userId, saved = 0, readError = false, writeError = false, conflict = false } = {}) {
  const project = { project_id: projectId, user_id: owner, saved_amount: saved };
  const queries = [], writes = [], trips = [];
  database = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: userId } : null }, error: null }) },
    from(table) {
      assert.ok(['exempt_projects', 'grocery_trips'].includes(table), `Tracking must not access ${table}`);
      const query = { table, filters: [], update: null, insert: null };
      const builder = {
        select() { return this; },
        eq(key, value) { query.filters.push([key, value]); return this; },
        update(value) { query.update = value; return this; },
        insert(value) { query.insert = value; return this; },
        single() { return execute(); },
        maybeSingle() { return execute(); },
      };
      async function execute() {
        queries.push(query);
        if ((query.update || query.insert) ? writeError : readError) return { data: null, error: { message: 'Fixture failure' } };
        if (query.insert) {
          const row = { ...query.insert, trip_id: 'fixture-trip' };
          trips.push(row); writes.push(row);
          return { data: row, error: null };
        }
        if (conflict && query.update) project.saved_amount = 20;
        if (!query.filters.every(([key, value]) => project[key] === value)) return { data: null, error: null };
        if (query.update) { Object.assign(project, query.update); writes.push({ ...query.update }); }
        return { data: { ...project }, error: null };
      }
      return builder;
    },
  };
  return { project, queries, writes, trips };
}

const fundingRequest = (body = { project_id: projectId, amount: 40 }) => new Request('http://localhost/api/vault/fund', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('saved grocery calendar date survives API storage and receipt rendering in every tested time zone', async () => {
  const db = fixture();
  const response = await receipt(new Request('http://localhost/api/groceries/receipt', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      source_account_id: accountId, store_name: 'costco-20/10', trip_date: '2026-10-20',
      raw_subtotal: 20, final_settled_total: 20,
      items: [{ id: 'oliveoil', name: 'Olive oil', shelfPrice: 20, isChecked: true }],
    }),
  }));
  assert.equal(response.status, 201);
  assert.equal(db.trips[0].trip_date, '2026-10-20');
  const previousTZ = process.env.TZ;
  try {
    for (const zone of ['America/Winnipeg', 'UTC', 'Pacific/Honolulu', 'Pacific/Kiritimati']) {
      process.env.TZ = zone;
      const html = renderToStaticMarkup(createElement(PastReceiptCard, { trip: db.trips[0] }));
      assert.match(html, /Oct 20, 2026/, zone);
      assert.doesNotMatch(html, /Oct 19|Oct 21/, zone);
      for (const date of ['2026-03-08', '2026-11-01', '2028-02-29', '2026-12-31']) {
        assert.equal(formatCalendarDate(date), new Intl.DateTimeFormat('en-CA', {
          month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
        }).format(new Date(`${date}T00:00:00Z`)), `${zone} ${date}`);
      }
    }
  } finally {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  }
});

test('invalid recorded calendar dates do not silently roll into another day', () => {
  for (const value of ['2026-02-30', 'invalid', '']) assert.equal(formatCalendarDate(value), 'Date unavailable');
});

test('manual project contribution works with no account and touches only the owned project', async () => {
  const db = fixture();
  const response = await fund(fundingRequest());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).project.saved_amount, 40);
  assert.equal(db.project.saved_amount, 40);
  assert.equal(db.writes.length, 1);
  assert.ok(db.queries.every(q => q.filters.some(([key, value]) => key === 'user_id' && value === userId)));
  const next = await fund(fundingRequest({ project_id: projectId, amount: 0.10 }));
  assert.equal(next.status, 200);
  assert.equal(db.project.saved_amount, 40.1);
});

test('legacy zero-balance client payload cannot require or deduct a checking account', async () => {
  const db = fixture({ saved: 10 });
  assert.equal((await fund(fundingRequest({ project_id: projectId, amount: 40, source_account_id: accountId }))).status, 200);
  assert.equal(db.project.saved_amount, 50);
});

test('unauthenticated, invalid and another-user contributions cannot change saved totals', async () => {
  let db = fixture({ authenticated: false });
  assert.equal((await fund(fundingRequest())).status, 401);
  assert.equal(db.queries.length, 0);
  for (const amount of [0, -1, 0.001, '40', null]) {
    db = fixture();
    assert.equal((await fund(fundingRequest({ project_id: projectId, amount }))).status, 400);
    assert.equal(db.writes.length, 0);
  }
  db = fixture({ owner: 'another-user' });
  assert.equal((await fund(fundingRequest())).status, 404);
  assert.equal(db.writes.length, 0);
});

test('concurrent contribution returns a conflict without overwriting the newer saved amount', async () => {
  const db = fixture({ saved: 10, conflict: true });
  const response = await fund(fundingRequest());
  assert.equal(response.status, 409);
  assert.equal(db.project.saved_amount, 20);
  assert.equal(db.writes.length, 0);
});

test('failed project reads or writes never report a successful contribution', async () => {
  for (const options of [{ readError: true }, { writeError: true }]) {
    const db = fixture({ saved: 10, ...options });
    assert.equal((await fund(fundingRequest())).status, 500);
    assert.equal(db.project.saved_amount, 10);
    assert.equal(db.writes.length, 0);
  }
});
