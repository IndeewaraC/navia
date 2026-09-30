import { Given, When, Then, After } from '@cucumber/cucumber';
import { expect, Page, BrowserContext, chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const adminAuthClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export async function provisionTestUser(userName: string) {
  const email = `test-${userName}-${Date.now()}@example.com`;
  const password = 'password123';

  const { data: user, error: createError } = await adminAuthClient.auth.admin.createUser({
    email, password, email_confirm: true
  });
  if (createError) throw createError;

  const cookies: Record<string, string> = {};
  const ssrClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return Object.keys(cookies).map(name => ({ name, value: cookies[name] })); },
      setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value }) => { cookies[name] = value; }); }
    }
  });

  await ssrClient.auth.signInWithPassword({ email, password });

  const cookieString = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');

  return { userId: user.user.id, email, cookieString };
}

export async function cleanupTestUser(userId: string) {
  await adminAuthClient.auth.admin.deleteUser(userId);
}

let page: Page;
let context: BrowserContext;
let testUserId: string;

Given('{string} has an active grocery trip at {string}', async function (username: string, store: string) {
  // Provision an authenticated session for the test
  const { userId, cookieString } = await provisionTestUser(username);
  testUserId = userId;

  // Make sure they have a checking account so active grocery page doesn't error
  await adminAuthClient.from('payment_accounts').insert({
    user_id: testUserId,
    account_alias: 'Primary Checking',
    account_type: 'DEBIT',
    current_statement_balance: 5000.00
  });

  const browser = await chromium.launch();
  context = await browser.newContext({ baseURL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000' });
  
  // Apply cookies to playwright browser context
  const parsedCookies = cookieString.split('; ').map(c => {
    const [name, ...rest] = c.split('=');
    return { name, value: rest.join('='), domain: 'localhost', path: '/' };
  });
  await context.addCookies(parsedCookies);

  page = await context.newPage();
  await page.goto(`/groceries/active?tripId=mock-trip-id`);
  
  // Since we don't have store name in header out of the box in active page if it's new trip, 
  // we might just need to wait for the page to load 'Live Cart' instead of the h2 store
  // or we can wait for the input that holds the store name.
  // The component starts with storeName="Local Supermarket" or empty.
  // We will just verify it loaded.
  await expect(page.locator('text=Live Cart')).toBeVisible();
});

Given('the Navia app is loaded on their mobile device', async function () {
  await expect(page.locator('text=Live Cart')).toBeVisible();
});

When('the device loses network connection', async function () {
  await context.setOffline(true);
  await expect(page.locator('text=⚡')).toBeVisible(); // 'Offline (Saved)' badge
});

When('{string} ticks off {string} and updates the price to ${float}', async function (username: string, item: string, price: number) {
  // We need to add the item first because the list starts empty
  const addInput = page.locator('input[placeholder="Add new item..."]');
  await addInput.fill(item);
  await page.locator('button', { hasText: 'Add' }).click();

  // Locate the specific item row (go up two levels from the span)
  const itemRow = page.locator(`span:has-text("${item}")`).locator('xpath=../..');
  
  // Tick the checkbox
  await itemRow.locator('input[type="checkbox"]').check();
  
  // Enter the shelf price
  await itemRow.locator('input[type="number"]').fill(price.toString());
});

Then('the checkout button should be disabled preventing API submission', async function () {
  const checkoutBtn = page.locator('button', { hasText: 'Save Receipt' });
  await expect(checkoutBtn).toBeDisabled();
});

Then('the data must be securely saved in the device\'s local storage', async function () {
  const cachedData = await page.evaluate(() => localStorage.getItem('navia_grocery_draft_mock-trip-id'));
  expect(cachedData).not.toBeNull();
  
  const parsedData = JSON.parse(cachedData!);
  const checkedItem = parsedData.items.find((i: any) => i.name === 'Chicken Breast');
  expect(checkedItem.isChecked).toBe(true);
  expect(checkedItem.shelfPrice).toBe(14.50);
});

When('the device regains network connection', async function () {
  await context.setOffline(false);
  await expect(page.locator('text=Online')).toBeVisible();
});

Then('the checkout button should be re-enabled', async function () {
  const checkoutBtn = page.locator('button', { hasText: 'Save Receipt' });
  await expect(checkoutBtn).toBeEnabled();
});

Then('submitting the receipt should successfully saved in the Grocery page.', async function () {
  const [request] = await Promise.all([
    page.waitForRequest(req => req.url().includes('/api/groceries/receipt') && req.method() === 'POST'),
    page.locator('button', { hasText: 'Save Receipt' }).click()
  ]);

  const postData = JSON.parse(request.postData()!);
  expect(postData.raw_subtotal).toBe(14.50);
  
  // Verify redirect to grocery page upon success
  await expect(page).toHaveURL(/\/groceries/);
});

After(async function () {
  if (page) await page.close();
  if (context) await context.close();
  if (testUserId) await cleanupTestUser(testUserId);
});
