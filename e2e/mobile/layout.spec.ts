import { test, expect, type Page, type Locator } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

let server: Server;
let baseURL: string;

test.beforeAll(async () => {
  test.setTimeout(60_000);
  const root = process.cwd();
  const output = path.join(root, '.next/mobile-layout-harness');
  await mkdir(output, { recursive: true });
  // Next ships webpack, so this harness uses the project's installed build
  // tools to exercise real TSX and Tailwind styles without a second app.
  const loadBuildTool = createRequire(path.join(root, 'package.json'));
  const { webpack } = loadBuildTool('next/dist/compiled/webpack/webpack');
  await new Promise<void>((resolve, reject) => {
    const compiler = webpack({
      mode: 'development', devtool: false,
      entry: path.join(root, 'e2e/mobile/fixtures/app.tsx'),
      output: { path: output, filename: 'app.js' },
      resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        alias: {
          '@/src/lib/supabase/client': path.join(root, 'e2e/mobile/fixtures/supabase.ts'),
          '@': root,
          'next/navigation': path.join(root, 'e2e/mobile/fixtures/navigation.tsx'),
          'next/link': path.join(root, 'e2e/mobile/fixtures/navigation.tsx'),
        },
      },
      module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.join(root, 'e2e/mobile/fixtures/typescript-loader.mjs') }] },
    });
    compiler.run((error: Error | null, stats?: { hasErrors(): boolean; toString(options: object): string }) => {
      compiler.close(() => {
        if (error || stats?.hasErrors()) reject(error || new Error(stats?.toString({ all: false, errors: true })));
        else resolve();
      });
    });
  });
  const source = path.join(root, 'src/app/globals.css');
  const styles = await postcss([tailwind()]).process(await readFile(source, 'utf8'), { from: source });
  const bundle = await readFile(path.join(output, 'app.js'));
  server = createServer((req, res) => {
    if (req.url === '/app.js') {
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); res.end(bundle);
    } else if (req.url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css; charset=utf-8'); res.end(styles.css);
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server failed to start');
  baseURL = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
});

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

const receiptActionUrl = '**/api/groceries/receipt/00000000-0000-4000-8000-000000000004';
const receiptTrip = (total: number | null) => ({
  trip_id: '00000000-0000-4000-8000-000000000004', store_name: 'costco-20/10', trip_date: '2026-10-20',
  final_settled_total: total, receipt_items: [{ id: 'oliveoil', name: 'Olive oil', shelfPrice: 20 }],
});

test('Past Receipts can add a missing total and edit it again after reloading', async ({ page }) => {
  const ledgerRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/transactions')) ledgerRequests.push(request.url()); });
  await page.goto(`${baseURL}/groceries/receipt-test?unpriced`);
  const card = page.getByRole('button', { name: 'View receipt for costco-20/10' });
  await expect(card).toContainText('Total not entered');
  const payloads: object[] = [];
  await page.route(receiptActionUrl, async route => {
    expect(route.request().method()).toBe('PATCH');
    const body = route.request().postDataJSON();
    payloads.push(body);
    await page.evaluate(total => localStorage.setItem('navia-receipt-service-fixture', JSON.stringify({ final_settled_total: total })), body.final_settled_total);
    await route.fulfill({ status: 200, json: { trip: receiptTrip(body.final_settled_total) } });
  });
  await page.getByRole('button', { name: 'Add total for costco-20/10', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Receipt for costco-20/10' });
  await page.getByRole('spinbutton', { name: 'Final receipt total ($)' }).fill('42.75');
  await dialog.getByRole('button', { name: 'Save total', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(card).toContainText('$42.75');
  await page.reload();
  await expect(card).toContainText('$42.75');
  await page.getByRole('button', { name: 'Edit total for costco-20/10', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Final receipt total ($)' })).toHaveValue('42.75');
  await page.getByRole('spinbutton', { name: 'Final receipt total ($)' }).fill('70.50');
  await dialog.getByRole('button', { name: 'Save total', exact: true }).click();
  await expect(card).toContainText('$70.50');
  expect(payloads).toEqual([
    { final_settled_total: 42.75, expected_total: null },
    { final_settled_total: 70.5, expected_total: 42.75 },
  ]);
  expect(ledgerRequests).toEqual([]);
});

test('Past Receipts deletion requires confirmation and Keep receipt sends no delete request', async ({ page }) => {
  await page.goto(`${baseURL}/groceries/receipt-test`);
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/groceries/receipt/')) requests.push(request.method()); });
  const remove = page.getByRole('button', { name: 'Delete receipt for costco-20/10', exact: true });
  await remove.click();
  const dialog = page.getByRole('dialog', { name: 'Receipt for costco-20/10' });
  await expect(dialog).toContainText('Your separate spending transaction will stay in the ledger.');
  const keep = dialog.getByRole('button', { name: 'Keep receipt' });
  await expect(keep).toBeFocused();
  await keep.click();
  await expect(dialog.getByRole('button', { name: 'Confirm delete' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(remove).toBeFocused();
  await expect(page.getByRole('button', { name: 'View receipt for costco-20/10' })).toBeVisible();
  expect(requests).toEqual([]);
});

test('Past Receipts deletion and Undo persist the restored receipt without sending a ledger request', async ({ page }) => {
  await page.goto(`${baseURL}/groceries/receipt-test`);
  const methods: string[] = [], ledgerRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/transactions')) ledgerRequests.push(request.url()); });
  await page.route(receiptActionUrl, async route => {
    const method = route.request().method();
    methods.push(method);
    if (method === 'DELETE') {
      expect(route.request().postDataJSON()).toEqual({ expected_total: 20 });
      await page.evaluate(() => localStorage.setItem('navia-receipt-service-fixture', JSON.stringify({ deleted: true, final_settled_total: 20 })));
      await route.fulfill({ status: 200, json: { undo_token: 'fixture-undo', undo_expires_at: Date.now() + 30_000 } });
    } else {
      expect(method).toBe('POST');
      expect(route.request().postDataJSON()).toEqual({ undo_token: 'fixture-undo' });
      await page.evaluate(() => localStorage.setItem('navia-receipt-service-fixture', JSON.stringify({ final_settled_total: 20 })));
      await route.fulfill({ status: 200, json: { trip: receiptTrip(20) } });
    }
  });
  await page.getByRole('button', { name: 'Delete receipt for costco-20/10', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View receipt for costco-20/10' })).toHaveCount(0);
  const undo = page.getByRole('button', { name: 'Undo delete for costco-20/10' });
  await expect(undo).toBeFocused();
  await undo.click();
  await expect(page.getByRole('button', { name: 'View receipt for costco-20/10' })).toContainText('$20.00');
  await expect(page.getByRole('status')).toContainText('Receipt restored.');
  await page.reload();
  await expect(page.getByRole('button', { name: 'View receipt for costco-20/10' })).toContainText('$20.00');
  expect(methods).toEqual(['DELETE', 'POST']);
  expect(ledgerRequests).toEqual([]);
});

test('Past Receipts deletion remains saved when Undo expires and the page reloads', async ({ page }) => {
  await page.clock.install({ time: new Date() });
  await page.goto(`${baseURL}/groceries/receipt-test`);
  await page.route(receiptActionUrl, async route => {
    expect(route.request().method()).toBe('DELETE');
    const now = await page.evaluate(() => Date.now());
    await page.evaluate(() => localStorage.setItem('navia-receipt-service-fixture', JSON.stringify({ deleted: true, final_settled_total: 20 })));
    await route.fulfill({ status: 200, json: { undo_token: 'fixture-undo', undo_expires_at: now + 30_000 } });
  });
  await page.getByRole('button', { name: 'Delete receipt for costco-20/10', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete', exact: true }).click();
  const undo = page.getByRole('button', { name: 'Undo delete for costco-20/10' });
  await expect(undo).toBeVisible();
  await page.clock.fastForward(30_000);
  await expect(undo).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('No grocery trips logged yet.')).toBeVisible();
});

test('Past Receipts keeps an entered total after a failed save and allows a retry', async ({ page }) => {
  await page.goto(`${baseURL}/groceries/receipt-test?unpriced`);
  let attempts = 0;
  await page.route(receiptActionUrl, route => route.fulfill(++attempts === 1
    ? { status: 503, json: { error: 'Unable to save this total right now.' } }
    : { status: 200, json: { trip: receiptTrip(42.75) } }));
  await page.getByRole('button', { name: 'Add total for costco-20/10', exact: true }).click();
  const input = page.getByRole('spinbutton', { name: 'Final receipt total ($)' });
  await input.fill('42.75');
  await page.getByRole('button', { name: 'Save total', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to save this total right now.');
  await expect(input).toHaveValue('42.75');
  await expect(page.getByRole('button', { name: 'View receipt for costco-20/10' })).toContainText('Total not entered');
  await page.getByRole('button', { name: 'Save total', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'View receipt for costco-20/10' })).toContainText('$42.75');
});

test('Past Receipts reports failed delete and failed Undo without discarding the retry', async ({ page }) => {
  await page.goto(`${baseURL}/groceries/receipt-test`);
  let deletes = 0, restores = 0;
  await page.route(receiptActionUrl, route => {
    if (route.request().method() === 'DELETE') return route.fulfill(++deletes === 1
      ? { status: 503, json: { error: 'Receipt was not deleted. Try again.' } }
      : { status: 200, json: { undo_token: 'fixture-undo', undo_expires_at: Date.now() + 30_000 } });
    return route.fulfill(++restores === 1
      ? { status: 503, json: { error: 'Unable to restore right now. Try again.' } }
      : { status: 200, json: { trip: receiptTrip(20) } });
  });
  await page.getByRole('button', { name: 'Delete receipt for costco-20/10', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Receipt was not deleted. Try again.');
  await expect(page.getByRole('button', { name: 'View receipt for costco-20/10' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Confirm delete', exact: true }).click();
  const undo = page.getByRole('button', { name: 'Undo delete for costco-20/10' });
  await undo.click();
  await expect(page.getByRole('alert')).toContainText('Unable to restore right now. Try again.');
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(page.getByRole('button', { name: 'View receipt for costco-20/10' })).toContainText('$20.00');
});

test('Past Receipts actions remain accessible in a short 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto(`${baseURL}/groceries/receipt-test`);
  const edit = page.getByRole('button', { name: 'Edit total for costco-20/10', exact: true });
  await edit.click();
  const input = page.getByRole('spinbutton', { name: 'Final receipt total ($)' });
  await expect(input).toBeFocused();
  const save = page.getByRole('button', { name: 'Save total', exact: true });
  await save.scrollIntoViewIfNeeded();
  const bounds = await save.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(420);
  await page.keyboard.press('Escape');
  await expect(edit).toBeFocused();
  await page.getByRole('button', { name: 'Delete receipt for costco-20/10', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Confirm delete', exact: true });
  await confirm.scrollIntoViewIfNeeded();
  const confirmBounds = await confirm.boundingBox();
  expect(confirmBounds!.y + confirmBounds!.height).toBeLessThanOrEqual(420);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `.next/mobile-layout-harness/receipt-actions-${test.info().project.name}-320.png`, fullPage: true });
});

for (const timezoneId of ['America/Winnipeg', 'UTC', 'Pacific/Kiritimati']) {
  test(`receipt list and details preserve October 20 in ${timezoneId}`, async ({ browser }) => {
    const context = await browser.newContext({ timezoneId, viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      await page.goto(`${baseURL}/groceries/receipt-test`);
      const card = page.getByRole('button', { name: 'View receipt for costco-20/10' });
      await expect(card).toContainText('Oct 20, 2026');
      await card.click();
      const dialog = page.getByRole('dialog', { name: 'Receipt for costco-20/10' });
      await expect(dialog).toContainText('Oct 20, 2026');
      await expect(dialog).not.toContainText('Oct 19');
      await expect(dialog).toContainText('$20.00');
      await page.getByRole('button', { name: 'Close receipt' }).click();
      await expect(dialog).toBeHidden();
      await expectNoHorizontalOverflow(page);
    } finally { await context.close(); }
  });
}

test('recording project funds needs no checking account and refreshes project progress', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseURL}/vault`);
  await page.getByRole('button', { name: '+ Add Funds' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Project Funds' });
  await expect(dialog).toContainText('tracking only');
  await page.getByRole('spinbutton', { name: 'Amount to Record ($)' }).fill('40');
  await page.route('**/api/vault/fund', async route => {
    const body = route.request().postDataJSON();
    expect(body).toEqual({ project_id: '00000000-0000-4000-8000-000000000002', amount: 40 });
    await page.evaluate(() => localStorage.setItem('navia-project-service-fixture', '40'));
    await route.fulfill({ status: 200, json: { message: 'Project funds recorded successfully', project: { saved_amount: 40 } } });
  });
  await dialog.getByRole('button', { name: 'Record Funds' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('$40.00', { exact: true })).toBeVisible();
  await expect(page.getByText('16% Funded', { exact: true })).toBeVisible();
  await expect(page.getByText('$0.00', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('16% Funded', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('failed project contribution shows an error without claiming the funds were recorded', async ({ page }) => {
  await page.goto(`${baseURL}/vault`);
  await page.getByRole('button', { name: '+ Add Funds' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Project Funds' });
  await page.getByRole('spinbutton', { name: 'Amount to Record ($)' }).fill('40');
  await page.route('**/api/vault/fund', route => route.fulfill({ status: 500, json: { error: 'Failed to record project funds.' } }));
  await dialog.getByRole('button', { name: 'Record Funds' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Failed to record project funds.');
  await expect(dialog).toBeVisible();
  await expect(page.getByText('0% Funded', { exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Amount to Record ($)' })).toHaveValue('40');
  await expect(dialog.getByRole('button', { name: 'Record Funds' })).toBeEnabled();
});

async function expectPriceAccessible(input: Locator, viewportWidth: number) {
  await input.scrollIntoViewIfNeeded();
  const bounds = await input.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewportWidth);
  const hit = await input.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { accessible: target === el, target: target?.outerHTML.slice(0, 250), x: rect.x, y: rect.y };
  });
  expect(hit.accessible, JSON.stringify(hit)).toBe(true);
  await input.click();
}

test('Later preserves the full grocery draft and resumes without checkout, including offline', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const receipts: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/groceries/receipt')) receipts.push(request.url());
  });
  await page.goto(`${baseURL}/groceries/active`);
  await page.getByPlaceholder('Name this grocery run...').fill('Weekend groceries');
  await page.getByRole('textbox', { name: 'New grocery item' }).fill('Milk');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Purchased Milk' }).check();
  await page.getByRole('spinbutton', { name: 'Price for Milk' }).fill('4.50');
  await page.getByRole('spinbutton', { name: 'Taxes and fees' }).fill('1.25');
  await page.getByRole('spinbutton', { name: 'Discounts' }).fill('0.50');
  await page.getByRole('spinbutton', { name: 'Final total', exact: true }).fill('10');
  await page.getByRole('textbox', { name: 'New grocery item' }).fill('Bread');
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByText('Offline (Saved)')).toBeVisible();
  await page.getByRole('button', { name: 'Later', exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/groceries`);

  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('navia_grocery_draft_mobile-regression')!));
  expect(draft.storeName).toBe('Weekend groceries');
  expect(draft.items).toEqual([
    expect.objectContaining({ name: 'Milk', shelfPrice: 4.5, isChecked: true }),
    expect.objectContaining({ name: 'Bread', shelfPrice: 0, isChecked: false }),
  ]);
  expect(draft.pricing).toEqual({ taxAndFees: 1.25, discounts: 0.5, manualTotal: 10 });
  await page.goto(`${baseURL}/groceries/active`);
  await expect(page.getByPlaceholder('Name this grocery run...')).toHaveValue('Weekend groceries');
  await expect(page.getByRole('checkbox', { name: 'Purchased Milk' })).toBeChecked();
  await expect(page.getByRole('spinbutton', { name: 'Price for Milk' })).toHaveValue('4.5');
  await expect(page.getByRole('spinbutton', { name: 'Price for Bread' })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Final total', exact: true })).toHaveValue('10');
  expect(receipts).toEqual([]);
});

test('Later stays on the cart if saving the draft fails', async ({ page }) => {
  await page.goto(`${baseURL}/groceries/active`);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); };
  });
  await page.getByRole('button', { name: 'Later', exact: true }).click();
  await expect(page.getByText('Unable to save your grocery list on this device. Please try again before leaving.')).toBeVisible();
  await expect(page).toHaveURL(`${baseURL}/groceries/active`);
});

test('a manual grocery total survives price adjustments and a failed save can be retried', async ({ page }) => {
  await page.goto(`${baseURL}/groceries/active`);
  for (const name of ['Milk', 'Bread', 'Rice']) {
    await page.getByRole('textbox', { name: 'New grocery item' }).fill(name);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
  }
  const finalTotal = page.getByRole('spinbutton', { name: 'Final total', exact: true });
  await finalTotal.fill('42.75');
  await page.getByRole('spinbutton', { name: 'Taxes and fees' }).fill('2');
  await expect(finalTotal).toHaveValue('42.75');
  await page.getByRole('spinbutton', { name: 'Discounts' }).fill('1');
  await page.getByRole('spinbutton', { name: 'Price for Milk' }).fill('4.5');
  await expect(finalTotal).toHaveValue('42.75');
  await page.reload();
  await expect(finalTotal).toHaveValue('42.75');

  const payloads: Array<Record<string, unknown>> = [];
  await page.route('**/api/groceries/receipt', route => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill(payloads.length === 1
      ? { status: 503, json: { error: 'Please retry saving your receipt.' } }
      : { status: 201, json: { trip_id: 'saved-trip' } });
  });
  const save = page.getByRole('button', { name: 'Save Receipt', exact: true });
  await save.click();
  await expect(page.getByText('Please retry saving your receipt.')).toBeVisible();
  await expect(finalTotal).toHaveValue('42.75');
  expect(await page.evaluate(() => localStorage.getItem('navia_grocery_draft_mobile-regression'))).not.toBeNull();
  await save.click();
  await expect(page).toHaveURL(`${baseURL}/groceries`);
  expect(payloads).toHaveLength(2);
  expect(payloads[1]).toMatchObject({ final_settled_total: 42.75, total_mode: 'manual', tax_and_fees: 2, discount_amount: 1 });
  expect(await page.evaluate(() => localStorage.getItem('navia_grocery_draft_mobile-regression'))).toBeNull();
});

test('a limit breach allows consecutive expenses and does not disable the modal after reopening', async ({ page }) => {
  await page.goto(`${baseURL}/ledger`);
  const payloads: Array<Record<string, unknown>> = [];
  await page.route('**/api/transactions', route => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: {
      transaction: { transaction_id: `expense-${payloads.length}` },
      threshold_alert: { level: 'BREACH', message: '100% Operational Limit Exceeded' },
    } });
  });
  const open = page.getByRole('button', { name: 'Add Expense', exact: true });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Log Expense', exact: true });
  const submit = dialog.getByRole('button', { name: 'Log Expense', exact: true });
  for (const amount of ['25', '15']) {
    await page.getByPlaceholder('0.00').fill(amount);
    await page.getByPlaceholder('Merchant or Shop...').fill('Over limit purchase');
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByText('100% Operational Limit Exceeded', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('0.00')).toHaveValue('');
  }
  await page.getByRole('button', { name: 'Close modal' }).click();
  await open.click();
  await page.getByPlaceholder('0.00').fill('10');
  await page.getByPlaceholder('Merchant or Shop...').fill('Another purchase');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect.poll(() => payloads.length).toBe(3);
  expect(payloads.map(payload => payload.amount)).toEqual([25, 15, 10]);
});

test('the total spent card includes operational and exempt amounts on a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`${baseURL}/ledger`);
  const card = page.getByRole('region', { name: 'Total spent', exact: true });
  await expect(card).toContainText('$130.40');
  await expect(card).toContainText('$100.10');
  await expect(card).toContainText('$30.30');
  await expectNoHorizontalOverflow(page);
});

test('the final grocery total can be replaced with a decimal or restored to the calculated total', async ({ page }) => {
  await page.goto(`${baseURL}/groceries/active`);
  for (const [name, price] of [['Milk', '4.50'], ['Bread', '5.25']]) {
    await page.getByRole('textbox', { name: 'New grocery item' }).fill(name);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('spinbutton', { name: `Price for ${name}` }).fill(price);
  }
  const total = page.getByRole('spinbutton', { name: 'Final total', exact: true });
  await expect(total).toHaveValue('9.75');
  await total.fill('');
  await total.pressSequentially('42.75');
  await expect(total).toHaveValue('42.75');
  await page.getByRole('spinbutton', { name: 'Taxes and fees' }).fill('2');
  await expect(total).toHaveValue('42.75');
  await page.getByRole('button', { name: 'Use calculated total' }).click();
  await expect(total).toHaveValue('11.75');
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 360, height: 420 }, // short viewport, as when a keyboard reduces space
  { width: 844, height: 390 }, // landscape
]) {
  test(`many grocery items can be priced and saved at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      if (window.location.pathname !== '/groceries/active' || localStorage.getItem('navia_grocery_draft_mobile-regression')) return;
      localStorage.setItem('navia_grocery_draft_mobile-regression', JSON.stringify({
        storeName: 'Mobile test store',
        items: Array.from({ length: 30 }, (_, i) => ({
          id: `item-${i}`, name: `Long grocery item ${i + 1} ${'LongName'.repeat(8)}`,
          shelfPrice: 0, isChecked: false,
        })), lastUpdated: Date.now(),
      }));
    });
    await page.goto(`${baseURL}/groceries/active`);
    const prices = page.getByRole('spinbutton', { name: /^Price for/ });
    await expect(prices).toHaveCount(30);
    const itemList = page.locator('[aria-label="Grocery items"]');
    await itemList.evaluate(el => { el.scrollTop = el.scrollHeight; });
    // Adding an item remains possible even with the list scrolled to the end.
    await page.getByRole('textbox', { name: 'New grocery item' }).fill('New item with a long description');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(prices).toHaveCount(31);
    await expectPriceAccessible(prices.last(), viewport.width);
    await prices.last().fill('9.75');
    await expectPriceAccessible(prices.first(), viewport.width);
    await prices.first().fill('4.50');
    await expectNoHorizontalOverflow(page);
    await page.getByRole('spinbutton', { name: 'Final total', exact: true }).fill('100.25');
    // Pricing and manual totals survive a refresh.
    await page.reload();
    await expect(prices.last()).toHaveValue('9.75');
    await expect(page.getByRole('spinbutton', { name: 'Final total', exact: true })).toHaveValue('100.25');
    // Alternate between complete receipts and partial tracking saves.
    const partial = viewport.width === 320 || viewport.width === 844;
    if (partial) await page.getByRole('spinbutton', { name: 'Final total', exact: true }).fill('');
    await page.route('**/api/groceries/receipt', route => route.fulfill({ status: 201, json: { trip_id: 'saved-trip' } }));
    const save = page.getByRole('button', { name: partial ? 'Save Prices Without Total' : 'Save Receipt', exact: true });
    await save.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const bounds = await save.boundingBox();
    const navBounds = await page.getByRole('navigation').boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(navBounds!.y);
    await page.screenshot({ path: path.join('.next/mobile-layout-harness', `groceries-${test.info().project.name}-${viewport.width}.png`) });
    const [request] = await Promise.all([
      page.waitForRequest('**/api/groceries/receipt'), save.click(),
    ]);
    const payload = request.postDataJSON();
    expect(payload).not.toHaveProperty('source_account_id');
    expect(payload.items).toHaveLength(31);
    expect(payload.items[0].shelfPrice).toBe(4.5);
    expect(payload.items[30].shelfPrice).toBe(9.75);
    expect(payload.final_settled_total).toBe(partial ? null : 100.25);
    await expect(page).toHaveURL(`${baseURL}/groceries`);
    expect(await page.evaluate(() => localStorage.getItem('navia_grocery_draft_mobile-regression'))).toBeNull();
    expect(errors).toEqual([]);
  });

  test(`expense button and modal remain accessible at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${baseURL}/ledger`);
    const add = page.getByRole('button', { name: 'Add Expense', exact: true });
    const addBounds = await add.boundingBox();
    const navBounds = await page.getByRole('navigation').boundingBox();
    expect(addBounds!.y + addBounds!.height).toBeLessThan(navBounds!.y);
    await add.click();
    const dialog = page.getByRole('dialog', { name: 'Log Expense', exact: true });
    await expect(dialog).toBeVisible();
    await page.getByRole('checkbox', { name: 'Exempt from Daily Cap' }).check();
    await page.getByPlaceholder('0.00').fill('25');
    await page.getByPlaceholder('Merchant or Shop...').fill('Mobile expense');
    const submit = dialog.getByRole('button', { name: 'Log Expense', exact: true });
    await submit.scrollIntoViewIfNeeded();
    const bounds = await submit.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    // The button must be hit-testable even where it overlaps the bottom nav.
    expect(await submit.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    })).toBe(true);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: path.join('.next/mobile-layout-harness', `expense-${test.info().project.name}-${viewport.width}.png`) });
    await page.route('**/api/transactions', route => route.fulfill({ status: 201, json: { transaction: { transaction_id: 'saved-expense' } } }));
    const requestPromise = page.waitForRequest('**/api/transactions');
    await submit.click();
    const payload = (await requestPromise).postDataJSON();
    expect(payload.amount).toBe(25);
    expect(payload.category).toBe('Mobile expense');
    expect(payload.is_budget_cap_exempt).toBe(true);
    await expect(dialog).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
    await add.click();
    await page.getByRole('button', { name: 'Close modal' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
  });
}

test('only one Magic Month banner appears and disappears after exactly one minute', async ({ page }) => {
  await page.clock.install();
  await page.goto(`${baseURL}/ledger`);
  const banner = page.getByRole('heading', { name: 'Magic Month Detected' });
  await expect(banner).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Route Funds' })).toHaveAttribute('href', '/vault');
  await page.clock.fastForward(59_000);
  await expect(banner).toBeVisible();
  await page.clock.fastForward(1_000);
  await expect(banner).toHaveCount(0);
  await page.goto(`${baseURL}/ledger?normal`);
  await expect(banner).toHaveCount(0);
});

test('an evening expense keeps its Winnipeg date after UTC midnight', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-23T02:00:00Z') });
  await page.goto(`${baseURL}/ledger`);
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
  await page.getByPlaceholder('0.00').fill('15');
  await page.getByPlaceholder('Merchant or Shop...').fill('Payday boundary test');
  await page.route('**/api/transactions', route => route.fulfill({ status: 201, json: { transaction: { transaction_id: 'boundary-expense' } } }));
  const requestPromise = page.waitForRequest('**/api/transactions');
  await page.getByRole('button', { name: 'Log Expense', exact: true }).click();
  expect((await requestPromise).postDataJSON().transaction_date).toBe('2026-10-22');
});

test('an evening grocery receipt keeps its Winnipeg date after UTC midnight', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-23T02:00:00Z') });
  await page.goto(`${baseURL}/groceries/active`);
  await page.getByRole('textbox', { name: 'New grocery item' }).fill('Milk');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Final total', exact: true }).fill('10');
  await page.route('**/api/groceries/receipt', route => route.fulfill({ status: 201, json: { trip_id: 'boundary-receipt' } }));
  const requestPromise = page.waitForRequest('**/api/groceries/receipt');
  await page.getByRole('button', { name: 'Save Receipt', exact: true }).click();
  expect((await requestPromise).postDataJSON().trip_date).toBe('2026-10-22');
});

test('changing the monthly reset date keeps the existing cycle start and persists after refresh', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-21T02:00:00Z') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/settings`);
  const resetDate = page.getByLabel('Anchor Pay Date');
  await expect(resetDate).toHaveValue('2026-11-14');
  await expect(page.getByText(/Choose the exact date for your next monthly reset/)).toBeVisible();
  await resetDate.fill('2026-11-21');
  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await expect(page.getByRole('status')).toHaveText('Configuration saved.');
  expect(await page.evaluate(() => window.__naviaResetFixture.metadata.navia_budget_cycle_start)).toBe('2026-10-14');
  await page.reload();
  await expect(resetDate).toHaveValue('2026-11-21');
  await expectNoHorizontalOverflow(page);
});

test('setting next month after a reset preserves the actual last reset date', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T18:00:00Z') });
  await page.goto(`${baseURL}/settings`);
  await expect(page.getByLabel('Anchor Pay Date')).toHaveValue('2026-11-14');
  await page.getByLabel('Anchor Pay Date').fill('2026-12-05');
  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await expect(page.getByRole('status')).toHaveText('Configuration saved.');
  expect(await page.evaluate(() => window.__naviaResetFixture.metadata.navia_budget_cycle_start)).toBe('2026-11-14');
});

for (const failure of ['save-error', 'metadata-error']) {
  test(`a ${failure} cannot report success or change the saved reset date`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-21T02:00:00Z') });
    await page.goto(`${baseURL}/settings?${failure}`);
    await expect(page.getByLabel('Anchor Pay Date')).toHaveValue('2026-11-14');
    await page.getByLabel('Anchor Pay Date').fill('2026-11-21');
    await page.getByRole('button', { name: 'Save Configuration' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
    expect(await page.evaluate(() => window.__naviaResetFixture.profile.anchor_pay_date)).toBe('2026-11-14');
    expect(await page.evaluate(() => window.__naviaResetFixture.profileWrites)).toBe(0);
  });
}

test('an October 2 past anchor is accepted and establishes the current cycle start', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-21T02:00:00Z') });
  await page.goto(`${baseURL}/settings`);
  await expect(page.getByLabel('Anchor Pay Date')).toHaveValue('2026-11-14');
  await page.getByLabel('Anchor Pay Date').fill('2026-10-02');
  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await expect(page.getByRole('status')).toHaveText('Configuration saved.');
  expect(await page.evaluate(() => window.__naviaResetFixture.metadata.navia_budget_cycle_start)).toBe('2026-10-02');
  await page.reload();
  await expect(page.getByLabel('Current Cycle Start Date')).toHaveValue('2026-10-02');
});

test('October 2 can be restored while retaining the November 14 next reset', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-21T02:00:00Z') });
  await page.goto(`${baseURL}/settings`);
  await expect(page.getByLabel('Current Cycle Start Date')).toHaveValue('2026-10-14');
  await page.getByLabel('Current Cycle Start Date').fill('2026-10-02');
  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await expect(page.getByRole('status')).toHaveText('Configuration saved.');
  await page.reload();
  await expect(page.getByLabel('Current Cycle Start Date')).toHaveValue('2026-10-02');
  await expect(page.getByLabel('Anchor Pay Date')).toHaveValue('2026-11-14');
});

test('a failed profile save restores the prior cycle start after an earlier date was entered', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-21T02:00:00Z') });
  await page.goto(`${baseURL}/settings?save-error`);
  await expect(page.getByLabel('Current Cycle Start Date')).toHaveValue('2026-10-14');
  await page.getByLabel('Current Cycle Start Date').fill('2026-10-02');
  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await expect(page.getByRole('alert')).toContainText('Your current cycle was kept');
  expect(await page.evaluate(() => window.__naviaResetFixture.metadata.navia_budget_cycle_start)).toBe('2026-10-14');
});

test('a current cycle start in the future is rejected', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-21T02:00:00Z') });
  await page.goto(`${baseURL}/settings`);
  await expect(page.getByLabel('Current Cycle Start Date')).toHaveValue('2026-10-14');
  await page.getByLabel('Current Cycle Start Date').fill('2026-11-01');
  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await expect(page.getByRole('alert')).toHaveText('Choose today or a past date for the current cycle start.');
  expect(await page.evaluate(() => window.__naviaResetFixture.profileWrites)).toBe(0);
});
