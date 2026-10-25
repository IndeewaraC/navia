import { test, expect } from '@playwright/test';
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
  const output = path.join(root, '.next/analyze-harness');
  await mkdir(output, { recursive: true });
  const load = createRequire(path.join(root, 'package.json'));
  const { webpack } = load('next/dist/compiled/webpack/webpack');
  await new Promise<void>((resolve, reject) => {
    const compiler = webpack({
      mode: 'development', devtool: false,
      entry: path.join(root, 'e2e/analyze/fixtures/app.tsx'),
      output: { path: output, filename: 'app.js' },
      resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        alias: {
          '@/src/lib/supabase/client': path.join(root, 'e2e/analyze/fixtures/supabase.ts'),
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
  server = createServer((request, response) => {
    if (request.url === '/app.js') {
      response.setHeader('Content-Type', 'text/javascript; charset=utf-8'); response.end(bundle);
    } else if (request.url === '/styles.css') {
      response.setHeader('Content-Type', 'text/css; charset=utf-8'); response.end(styles.css);
    } else {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
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

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2030-10-20T12:00:00Z') });
});

test('date filters and merchant search show combined totals while payment totals retain the full period', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseURL}/analyze`);
  await expect(page.getByRole('region', { name: 'Total spent' })).toContainText('$70.30');
  await page.getByLabel('End date').fill('2030-10-31');
  await page.getByRole('button', { name: 'Analyze spending' }).click();
  await expect(page.getByRole('region', { name: 'Total spent' })).toContainText('$100.30');
  const payments = page.getByRole('region', { name: 'By payment method' });
  await expect(payments.getByRole('listitem').filter({ hasText: 'Visa' })).toContainText('$50.10');
  await expect(payments.getByRole('listitem').filter({ hasText: 'Cash' })).toContainText('$50.20');
  await expect(payments.getByRole('listitem').filter({ hasText: 'Savings' })).toContainText('$0.00');
  await page.getByLabel('Search merchant or description').fill('  COFFEE   shop  ');
  await expect(page.getByRole('status')).toContainText('$30.30');
  await expect(page.getByRole('status')).toContainText('2 expenses');
  await expect(page.getByRole('list', { name: 'Merchant spending' }).getByRole('listitem')).toHaveCount(1);
  await expect(payments.getByRole('listitem').filter({ hasText: 'Cash' })).toContainText('$50.20');
  await page.getByLabel('Search merchant or description').fill('coffee');
  await expect(page.getByRole('status')).toContainText('$60.30');
  await expect(page.getByRole('list', { name: 'Merchant spending' }).getByRole('listitem')).toHaveCount(2);
  await page.getByLabel('Search merchant or description').fill('no such merchant');
  await expect(page.getByText('No merchants or descriptions match your search.')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('$0.00');
  expect(errors).toEqual([]);
});

test('same-day filters include that day and an invalid range leaves the prior analysis intact', async ({ page }) => {
  await page.goto(`${baseURL}/analyze`);
  await expect(page.getByRole('region', { name: 'Total spent' })).toContainText('$70.30');
  await page.getByLabel('Start date').fill('2030-10-15');
  await page.getByLabel('End date').fill('2030-10-15');
  await page.getByRole('button', { name: 'Analyze spending' }).click();
  await expect(page.getByRole('region', { name: 'Total spent' })).toContainText('$20.20');
  await page.getByLabel('Start date').fill('2030-10-16');
  await page.getByRole('button', { name: 'Analyze spending' }).click();
  await expect(page.getByRole('alert')).toHaveText('The end date must be on or after the start date.');
  await expect(page.getByRole('region', { name: 'Total spent' })).toContainText('$20.20');
  await page.getByLabel('Start date').fill('2030-12-01');
  await page.getByLabel('End date').fill('2030-12-31');
  await page.getByRole('button', { name: 'Analyze spending' }).click();
  await expect(page.getByRole('region', { name: 'Total spent' })).toContainText('$0.00');
  await expect(page.getByText('No expenses in this time frame. Try a different date range.')).toBeVisible();
});

for (const table of ['transactions', 'payment_accounts']) {
  test(`${table} errors show a retry without partial spending totals`, async ({ page }) => {
    await page.goto(`${baseURL}/analyze?fail-${table}`);
    await expect(page.getByRole('alert')).toContainText('Unable to load your spending.');
    await expect(page.getByRole('region', { name: 'Total spent' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('region', { name: 'Total spent' })).toContainText('$70.30');
  });
}

test('320px screens keep dates, spending and all six navigation links accessible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`${baseURL}/analyze`);
  await expect(page.getByRole('region', { name: 'Total spent' })).toContainText('$70.30');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const nav = page.getByRole('navigation');
  await expect(nav.getByRole('link')).toHaveCount(6);
  await expect(nav.getByRole('link', { name: 'Analyze', exact: true })).toHaveAttribute('aria-current', 'page');
  for (const link of await nav.getByRole('link').all()) {
    const bounds = await link.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  }
  await page.screenshot({ path: '.next/analyze-harness/analyze-320.png', fullPage: true });
});
