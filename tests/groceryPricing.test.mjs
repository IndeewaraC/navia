import tsNode from 'ts-node';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

tsNode.register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS', moduleResolution: 'node' },
});
const loadTypeScript = createRequire(import.meta.url);
const { calculateGroceryTotal } = loadTypeScript('../src/lib/groceryPricing.ts');
const prices = (...values) => values.map(shelfPrice => ({ shelfPrice }));

test('all item prices calculate a rounded total including taxes and discounts', () => {
  assert.deepEqual(calculateGroceryTotal(prices(4.50, 3.20), 0.80, 0.30, null), {
    subtotal: 7.70, allPriced: true, total: 8.20, error: '',
  });
  assert.equal(calculateGroceryTotal(prices(0.1, 0.2), 0, 0, null).total, 0.3);
});

test('a manual total works with no item prices and overrides the calculated total', () => {
  assert.equal(calculateGroceryTotal(prices(0, 0), 0, 0, 25).total, 25);
  assert.equal(calculateGroceryTotal(prices(5, 10), 0, 0, 20).total, 20);
  assert.equal(calculateGroceryTotal([], 0, 0, 25).error, '');
});

test('partial prices on larger lists remain unknown rather than becoming a total', () => {
  for (const values of [[5, 0, 0], [5, 10, 0], [0, 0, 0]]) {
    const result = calculateGroceryTotal(prices(...values), 2, 0, null);
    assert.equal(result.total, null);
    assert.equal(result.error, '');
  }
});

test('small lists require all prices or a manual total', () => {
  for (const values of [[], [0], [5, 0], [0, 0]]) {
    assert.ok(calculateGroceryTotal(prices(...values), 0, 0, null).error);
    assert.equal(calculateGroceryTotal(prices(...values), 0, 0, 10).error, '');
  }
  assert.equal(calculateGroceryTotal(prices(5), 0, 0, null).total, 5);
  assert.equal(calculateGroceryTotal(prices(5, 10), 0, 0, null).total, 15);
});

test('invalid totals are rejected', () => {
  for (const total of [0, -1, NaN, Infinity]) {
    assert.ok(calculateGroceryTotal(prices(1), 0, 0, total).error);
  }
  assert.ok(calculateGroceryTotal(prices(5), 0, 10, null).error);
});
