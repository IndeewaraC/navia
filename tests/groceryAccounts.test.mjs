import tsNode from 'ts-node';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';

tsNode.register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS', moduleResolution: 'node', jsx: 'react-jsx' },
});
const loadTypeScript = createRequire(import.meta.url);
let supabase;
const originalLoad = Module._load;
let ActiveGroceryTripPage;
let POST;
let revalidatedPaths = [];

// Exercise the real server page and receipt handler against a local data boundary.
try {
  Module._load = function (specifier, ...args) {
    if (specifier === '@/src/lib/supabase/server') {
      return { createClient: async () => supabase };
    }
    if (specifier === '@/src/components/groceries/GroceryChecklist') {
      return { __esModule: true, default: () => null };
    }
    if (specifier === '@/src/lib/groceryPricing') {
      return loadTypeScript('../src/lib/groceryPricing.ts');
    }
    if (specifier === 'next/cache') {
      return { revalidatePath: path => revalidatedPaths.push(path) };
    }
    return originalLoad.call(this, specifier, ...args);
  };
  ActiveGroceryTripPage = loadTypeScript('../src/app/(dashboard)/groceries/active/page.tsx').default;
  ({ POST } = loadTypeScript('../src/app/api/groceries/receipt/route.ts'));
} finally {
  Module._load = originalLoad;
}

function fixture(user = { id: 'grocery-user' }) {
  revalidatedPaths = [];
  const writes = [];
  supabase = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      assert.equal(table, 'grocery_trips', 'Groceries must not access or create payment accounts');
      return {
        insert(row) {
          writes.push({ table, row });
          return { select: () => ({ single: async () => ({ data: { trip_id: 'saved-trip' }, error: null }) }) };
        },
      };
    },
  };
  return writes;
}

test('opening and reloading a grocery cart never accesses payment accounts', async () => {
  const writes = fixture();
  for (let visit = 0; visit < 3; visit++) {
    const page = await ActiveGroceryTripPage({ searchParams: Promise.resolve({ tripId: 'saved-cart' }) });
    assert.equal(page.props.children.props.tripId, 'saved-cart');
  }
  assert.deepEqual(writes, []);
});

test('unauthenticated cart visits redirect to login without writing data', async () => {
  const writes = fixture(null);
  await assert.rejects(
    ActiveGroceryTripPage({ searchParams: Promise.resolve({}) }),
    error => error.digest?.includes('/login'),
  );
  assert.deepEqual(writes, []);
});

const item = (name, shelfPrice) => ({ id: name, name, shelfPrice, isChecked: true });
const receipt = {
  store_name: 'User store', trip_date: '2026-10-24',
  raw_subtotal: 8, tax_and_fees: 0, discount_amount: 0,
  final_settled_total: 8, total_mode: 'calculated',
  items: [item('Milk', 3), item('Bread', 5)],
};
function submit(body) {
  return POST(new Request('http://localhost/api/groceries/receipt', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
}

for (const [mode, body] of [
  ['calculated', receipt],
  ['manual', { ...receipt, final_settled_total: 10, total_mode: 'manual' }],
  ['manual total without item prices', { ...receipt, raw_subtotal: 0, final_settled_total: 42.75, total_mode: 'manual', tax_and_fees: 2, discount_amount: 1, items: [item('Milk', 0), item('Bread', 0), item('Rice', 0)] }],
  ['manual total without items', { ...receipt, raw_subtotal: 0, final_settled_total: 26.19, total_mode: 'manual', items: [] }],
  ['partial prices', { ...receipt, raw_subtotal: 3, final_settled_total: null, total_mode: 'unknown', items: [item('Milk', 3), item('Bread', 0), item('Rice', 0)] }],
  ['legacy client', { ...receipt, source_account_id: '5f0b7d48-1f2c-4ef0-9e2e-531b4a1ba331' }],
]) {
  test(`${mode} receipts save without requiring a payment account`, async () => {
    const writes = fixture();
    const response = await submit(body);
    assert.equal(response.status, 201, JSON.stringify(await response.json()));
    assert.equal(writes.length, 1);
    assert.equal(writes[0].row.user_id, 'grocery-user');
    assert.equal(writes[0].row.final_settled_total, body.final_settled_total);
    assert.deepEqual(writes[0].row.receipt_items, body.items);
    assert.equal('source_account_id' in writes[0].row, false);
    assert.deepEqual(revalidatedPaths, ['/groceries']);
  });
}

test('receipt authentication and total validation still prevent invalid writes', async () => {
  let writes = fixture(null);
  assert.equal((await submit(receipt)).status, 401);
  assert.deepEqual(writes, []);
  writes = fixture();
  assert.equal((await submit({ ...receipt, final_settled_total: 99 })).status, 400);
  assert.deepEqual(writes, []);
});
