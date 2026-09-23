import { Given, When, Then } from '@cucumber/cucumber';
import { expect, Page, BrowserContext, chromium } from '@playwright/test';

let page: Page;
let context: BrowserContext;

Given('{string} has an active grocery trip at {string}', async function (username: string, store: string) {
  // Scaffold browser launch for the test
  if (!page) {
    const browser = await chromium.launch();
    context = await browser.newContext({ baseURL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000' });
    page = await context.newPage();
  }

  // Navigate to the grocery checklist page with mock trip data
  // NOTE: Adjusted route to /ledger to match the dashboard route group structure
  await page.goto(`/ledger/groceries/trip/mock-trip-id`);
  await expect(page.locator('h2')).toContainText(store);
});

Given('the Navia app is loaded on their mobile device', async function () {
  // Ensure the page has fully hydrated
  await expect(page.locator('text=Live Cart')).toBeVisible();
});

When('the device loses network connection', async function () {
  // Simulate walking into a cellular dead zone
  await context.setOffline(true);
  await expect(page.locator('text=⚡ Offline (Saved)')).toBeVisible();
});

When('{string} ticks off {string} and updates the price to ${float}', async function (username: string, item: string, price: number) {
  // Locate the specific item row
  const itemRow = page.locator(`text=${item}`).locator('..');
  
  // Tick the checkbox
  await itemRow.locator('input[type="checkbox"]').check();
  
  // Enter the shelf price
  await itemRow.locator('input[type="number"]').fill(price.toString());
});

Then('the checkout button should be disabled preventing API submission', async function () {
  const checkoutBtn = page.locator('button', { hasText: 'Confirm & Log to Ledger' });
  await expect(checkoutBtn).toBeDisabled();
});

Then('the data must be securely saved in the device\'s local storage', async function () {
  // Extract the localStorage payload directly from the browser context
  const cachedData = await page.evaluate(() => localStorage.getItem('navia_grocery_draft_mock-trip-id'));
  expect(cachedData).not.toBeNull();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsedData = JSON.parse(cachedData!);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checkedItem = parsedData.find((i: any) => i.name === 'Chicken Breast');
  expect(checkedItem.isChecked).toBe(true);
  expect(checkedItem.shelfPrice).toBe(14.50);
});

When('the device regains network connection', async function () {
  // Simulate walking out to the parking lot
  await context.setOffline(false);
  await expect(page.locator('text=Online')).toBeVisible();
});

Then('the checkout button should be re-enabled', async function () {
  const checkoutBtn = page.locator('button', { hasText: 'Confirm & Log to Ledger' });
  await expect(checkoutBtn).toBeEnabled();
});

Then('submitting the receipt should successfully route the total to the ledger', async function () {
  // Intercept the API call to ensure the frontend sends the correct math payload
  const [request] = await Promise.all([
    page.waitForRequest(req => req.url().includes('/api/groceries/receipt') && req.method() === 'POST'),
    page.locator('button', { hasText: 'Confirm & Log to Ledger' }).click()
  ]);

  const postData = JSON.parse(request.postData()!);
  expect(postData.raw_subtotal).toBe(14.50);
  
  // Verify redirect to ledger upon success
  await expect(page).toHaveURL(/\/ledger/);
});
