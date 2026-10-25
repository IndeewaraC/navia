import tsNode from 'ts-node';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import path from 'node:path';

tsNode.register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const require = createRequire(import.meta.url);
let database, session, revalidated;
const originalLoad = Module._load;
Module._load = function (id, parent, isMain) {
  if (id === '@/src/lib/supabase/server') return { createClient: () => session };
  if (id === '@/src/lib/supabase/admin') return { createAdminClient: () => database };
  if (id === 'next/cache') return { revalidatePath: value => revalidated.push(value) };
  if (id.startsWith('@/')) id = path.resolve(id.slice(2));
  return originalLoad.call(this, id, parent, isMain);
};
let PATCH, DELETE, POST;
try { ({ PATCH, DELETE, POST } = require('../src/app/api/groceries/receipt/[tripId]/route.ts')); }
finally { Module._load = originalLoad; }

process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-fixture-undo-signing-key';
const userId = '00000000-0000-4000-8000-000000000001';
const tripId = '00000000-0000-4000-8000-000000000004';
const transactionId = '00000000-0000-4000-8000-000000000005';
const snapshot = {
  trip_id: tripId, user_id: userId, transaction_id: transactionId,
  store_name: 'Costco', trip_date: '2026-10-20', created_at: '2026-10-21T01:00:00Z',
  raw_subtotal: 0, tax_and_fees: 2, discount_amount: 1, final_settled_total: null,
  receipt_items: [{ id: 'milk', name: 'Milk', shelfPrice: 0, isChecked: true }],
};

function fixture({ user = userId, owner = userId, total = null, readError = false, writeError = false, concurrentTotal } = {}) {
  revalidated = [];
  const receipts = [{ ...structuredClone(snapshot), user_id: owner, final_settled_total: total }];
  const transactions = [{ transaction_id: transactionId, user_id: userId, amount: 50, txn_type: 'EXPENSE' }];
  const queries = [], writes = [];
  session = { auth: { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) } };
  database = {
    from(table) {
      assert.equal(table, 'grocery_trips', 'Receipt actions must never read, create or change ledger transactions');
      const query = { filters: [], update: null, insert: null, deleting: false };
      const builder = {
        select() { return this; },
        eq(key, value) { query.filters.push([key, value]); return this; },
        is(key, value) { query.filters.push([key, value]); return this; },
        update(value) { query.update = value; return this; },
        insert(value) { query.insert = value; return this; },
        delete() { query.deleting = true; return this; },
        single() { return execute(); },
        maybeSingle() { return execute(); },
      };
      async function execute() {
        queries.push(query);
        const writing = query.update || query.insert || query.deleting;
        if (writing ? writeError : readError) return { data: null, error: { code: 'XX000' } };
        if (query.insert) {
          assert.equal(query.insert.user_id, user);
          if (receipts.some(row => row.trip_id === query.insert.trip_id)) return { data: null, error: { code: '23505' } };
          const row = structuredClone(query.insert);
          receipts.push(row); writes.push({ insert: structuredClone(row) });
          return { data: structuredClone(row), error: null };
        }
        assert.ok(query.filters.some(([key, value]) => key === 'user_id' && value === user), 'All reads, updates and deletes must be scoped to the authenticated user');
        if (writing && concurrentTotal !== undefined && receipts[0]) receipts[0].final_settled_total = concurrentTotal;
        const index = receipts.findIndex(row => query.filters.every(([key, value]) => row[key] === value));
        if (index < 0) return { data: null, error: null };
        const row = receipts[index];
        if (query.update) { Object.assign(row, query.update); writes.push({ update: query.update }); }
        if (query.deleting) { receipts.splice(index, 1); writes.push({ deleted: row.trip_id }); }
        return { data: structuredClone(row), error: null };
      }
      return builder;
    },
  };
  return { receipts, transactions, queries, writes };
}

function act(method, body, id = tripId) {
  const request = new Request(`http://localhost/api/groceries/receipt/${id}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return ({ PATCH, DELETE, POST })[method](request, { params: Promise.resolve({ tripId: id }) });
}

test('adding and editing a final total preserves every other receipt field and the separate ledger transaction', async () => {
  for (const total of [null, 20]) {
    const db = fixture({ total });
    const ledger = structuredClone(db.transactions);
    const result = await act('PATCH', { final_settled_total: 42.75, expected_total: total });
    assert.equal(result.status, 200);
    assert.deepEqual(db.receipts[0], { ...snapshot, final_settled_total: 42.75 });
    assert.deepEqual(db.writes, [{ update: { final_settled_total: 42.75 } }]);
    assert.deepEqual(db.transactions, ledger);
    assert.deepEqual(revalidated, ['/groceries']);
  }
});

test('invalid totals and extra fields cannot alter receipt or ledger data', async () => {
  for (const total of [0, -1, 1.001, '20', null, Infinity]) {
    const db = fixture();
    assert.equal((await act('PATCH', { final_settled_total: total, expected_total: null })).status, 400);
    assert.equal(db.writes.length, 0);
  }
  const db = fixture();
  assert.equal((await act('PATCH', { final_settled_total: 20, expected_total: null, transaction_id: null })).status, 400);
  assert.equal(db.writes.length, 0);
});

test('authentication, receipt IDs and ownership are checked for every action', async () => {
  for (const method of ['PATCH', 'DELETE', 'POST']) {
    let db = fixture({ user: null });
    assert.equal((await act(method, {})).status, 401);
    assert.equal(db.queries.length, 0);
    db = fixture();
    assert.equal((await act(method, {}, 'invalid-id')).status, 400);
    assert.equal(db.queries.length, 0);
  }
  for (const method of ['PATCH', 'DELETE']) {
    const db = fixture({ owner: 'another-user' });
    const result = await act(method, method === 'PATCH' ? { final_settled_total: 20, expected_total: null } : { expected_total: null });
    assert.equal(result.status, 404);
    assert.equal(db.writes.length, 0);
  }
});

test('concurrent total edits prevent stale edits and stale deletes', async () => {
  for (const method of ['PATCH', 'DELETE']) {
    const db = fixture({ total: 20, concurrentTotal: 30 });
    const response = await act(method, method === 'PATCH' ? { final_settled_total: 40, expected_total: 20 } : { expected_total: 20 });
    assert.equal(response.status, 409);
    assert.equal(db.receipts[0].final_settled_total, 30);
    assert.equal(db.writes.length, 0);
  }
});

test('delete and Undo restore the original receipt ID, date, items and transaction link without modifying ledger spending', async () => {
  const db = fixture();
  const ledger = structuredClone(db.transactions);
  const response = await act('DELETE', { expected_total: null });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(typeof body.undo_token, 'string');
  assert.ok(body.undo_expires_at > Date.now());
  assert.equal(db.receipts.length, 0);
  assert.deepEqual(db.transactions, ledger);
  const restore = await act('POST', { undo_token: body.undo_token });
  assert.equal(restore.status, 200);
  assert.deepEqual(db.receipts, [snapshot]);
  assert.deepEqual((await restore.json()).trip, snapshot);
  assert.deepEqual(db.transactions, ledger);
});

test('repeated Undo is idempotent and cannot overwrite edits made after restoration', async () => {
  const db = fixture();
  const body = await (await act('DELETE', { expected_total: null })).json();
  assert.equal((await act('POST', { undo_token: body.undo_token })).status, 200);
  assert.equal((await act('PATCH', { final_settled_total: 75.5, expected_total: null })).status, 200);
  const repeated = await act('POST', { undo_token: body.undo_token });
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).trip.final_settled_total, 75.5);
  assert.equal(db.receipts.length, 1);
  assert.equal(db.writes.filter(write => write.insert).length, 1);
});

test('tampered snapshots, other users and other receipt IDs cannot restore a deleted receipt', async () => {
  const db = fixture();
  const body = await (await act('DELETE', { expected_total: null })).json();
  const [payload, signed] = body.undo_token.split('.');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  decoded.receipt.final_settled_total = 999;
  const tampered = `${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${signed}`;
  assert.equal((await act('POST', { undo_token: tampered })).status, 400);
  assert.equal((await act('POST', { undo_token: body.undo_token }, transactionId)).status, 400);
  session.auth.getUser = async () => ({ data: { user: { id: 'another-user' } }, error: null });
  assert.equal((await act('POST', { undo_token: body.undo_token })).status, 400);
  assert.equal(db.receipts.length, 0);
  assert.equal(db.writes.length, 1);
});

test('Undo expires after 30 seconds and cannot recreate the deleted record', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-25T12:00:00Z') });
  const db = fixture();
  const body = await (await act('DELETE', { expected_total: null })).json();
  assert.equal(body.undo_expires_at, Date.now() + 30_000);
  t.mock.timers.setTime(Date.now() + 30_000);
  assert.equal((await act('POST', { undo_token: body.undo_token })).status, 410);
  assert.equal(db.receipts.length, 0);
});

test('read and write failures never claim success or discard a receipt', async () => {
  for (const options of [{ readError: true }, { writeError: true }]) {
    for (const method of ['PATCH', 'DELETE']) {
      const db = fixture(options);
      const result = await act(method, method === 'PATCH' ? { final_settled_total: 20, expected_total: null } : { expected_total: null });
      assert.equal(result.status, 500);
      assert.deepEqual(db.receipts, [snapshot]);
      assert.equal(db.writes.length, 0);
    }
  }
});

test('missing recovery configuration prevents deletion before any write', async () => {
  const db = fixture();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal((await act('DELETE', { expected_total: null })).status, 503);
    assert.deepEqual(db.receipts, [snapshot]);
    assert.equal(db.writes.length, 0);
  } finally { process.env.SUPABASE_SERVICE_ROLE_KEY = secret; }
});
