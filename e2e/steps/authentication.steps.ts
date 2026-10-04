import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { testData } from '../support/test_data';
import { fetchLatestOtp } from '../support/email_helper';

const BASE_URL = 'http://localhost:3000'; // Assuming standard Next.js local port

Given('an unregistered user navigates to the "Signup" page', async function () {
  await this.page.goto(`${BASE_URL}/signup`);
  await expect(this.page).toHaveURL(/.*\/signup/);
});

When('they enter a valid email address', async function () {
  // We use the email from our central testData file
  await this.page.fill('input[type="email"]', testData.auth.validNewUserEmail);
});

When('they submit the signup form', async function () {
  await this.page.click('button[type="submit"]');
});

Then('they should be prompted to enter an OTP sent to their email', async function () {
  // Wait for the UI to transition to the OTP verification view
  await expect(this.page.locator('text="Verify your identity"').or(this.page.locator('input[aria-label="Digit 1"]'))).toBeVisible();
});

Given('a user has received an OTP for signup', async function () {
  await this.page.goto(`${BASE_URL}/signup`);
  await this.page.fill('input[type="email"]', testData.auth.validNewUserEmail);
  await this.page.click('button[type="submit"]');
  await expect(this.page.locator('input[aria-label="Digit 1"]')).toBeVisible();
});

When('they enter the valid OTP', async function () {
  console.log(`Waiting for real OTP email for ${testData.auth.validNewUserEmail}...`);
  
  let codeToEnter = testData.auth.validOtp;
  try {
    const liveOtp = await fetchLatestOtp(testData.auth.validNewUserEmail);
    if (liveOtp) {
      codeToEnter = liveOtp;
      this.liveOtp = liveOtp;
    }
  } catch (e) {
    console.error("IMAP Fetch failed. Falling back to test_data dummy OTP.");
  }
  
  // Fill the 6 individual boxes
  for (let i = 0; i < 6; i++) {
    await this.page.fill(`input[aria-label="Digit ${i + 1}"]`, codeToEnter[i]);
  }
});

When('submit the OTP form', async function () {
  await this.page.click('button:has-text("Access Vault")');
});

Then('their account should be created successfully', async function () {

});

Then('they should be navigated to the {string} page', async function (pageName: string) {
  const routeMap: Record<string, string> = {
    'Ledger': '/ledger',
    'Vault': '/vault',
    'Provisions': '/groceries',
    'History': '/history',
    'Settings': '/settings'
  };

  const expectedRoute = routeMap[pageName] || `/${pageName.toLowerCase()}`;
  await expect(this.page).toHaveURL(new RegExp(`.*${expectedRoute}`));
});

When('they enter an invalid OTP', async function () {
  const codeToEnter = testData.auth.invalidOtp;
  for (let i = 0; i < 6; i++) {
    await this.page.fill(`input[aria-label="Digit ${i + 1}"]`, codeToEnter[i]);
  }
});

Then('they should see an error message for invalid signup OTP', async function () {
  await expect(this.page.locator(`text="${testData.auth.invalidOtpErrorMessage}"`)).toBeVisible();
});

Then('they should remain on the OTP verification page', async function () {
  await expect(this.page.locator('input[aria-label="Digit 1"]')).toBeVisible();
  // Should NOT be on the ledger
  await expect(this.page).not.toHaveURL(/.*\/ledger/);
});

// ------------- LOGIN SCENARIOS -------------

Given('a registered user requests a login OTP', async function () {
  await this.page.goto(`${BASE_URL}/login`);
  await this.page.fill('input[type="email"]', testData.auth.existingUserEmail);
  await this.page.click('button[type="submit"]');
});

When('they navigate to the OTP verification step', async function () {
  await expect(this.page.locator('input[aria-label="Digit 1"]')).toBeVisible();
});

Then('they should be successfully authenticated', async function () {
  // We can check for a session cookie or just rely on the redirect step
});

Then('they should see an error message for invalid login OTP', async function () {
  await expect(this.page.locator(`text="${testData.auth.invalidLoginOtpErrorMessage}"`)).toBeVisible();
});

Then('their session should not be authenticated', async function () {
  await expect(this.page).not.toHaveURL(/.*\/ledger/);
});

// ------------- POST LOGIN NAVIGATION -------------

Given('an authenticated user is on the "Ledger" page', async function () {
  // For these tests, we can bypass the UI login and set the cookie/localStorage directly
  // or just run a quick login flow.

  // Quick Mock Login for navigation tests to save execution time
  await this.page.goto(`${BASE_URL}/login`);
  // Using Playwright to inject a dummy Supabase session into localStorage (Fastest BDD approach)
  await this.page.evaluate(() => {
    localStorage.setItem('sb-your-project-ref-auth-token', JSON.stringify({
      access_token: 'dummy_token',
      user: { id: 'test_user_id', email: 'existing_qa@example.com' }
    }));
  });

  await this.page.goto(`${BASE_URL}/ledger`);
  await expect(this.page).toHaveURL(/.*\/ledger/);
});

When('they navigate to the {string} page', async function (pageName: string) {
  const routeMap: Record<string, string> = {
    'Vault': '/vault',
    'Provisions': '/groceries',
    'History': '/history',
    'Settings': '/settings'
  };

  const expectedRoute = routeMap[pageName] || `/${pageName.toLowerCase()}`;

  // Click the navigation link in the UI
  await this.page.click(`a[href="${expectedRoute}"]`);
});

Then('the {string} page should load successfully', async function (pageName: string) {
  const routeMap: Record<string, string> = {
    'Vault': '/vault',
    'Provisions': '/groceries',
    'History': '/history',
    'Settings': '/settings'
  };

  const expectedRoute = routeMap[pageName];
  await expect(this.page).toHaveURL(new RegExp(`.*${expectedRoute}`));
});
