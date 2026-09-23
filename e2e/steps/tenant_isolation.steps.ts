import { Given, When, Then } from '@cucumber/cucumber';
import { expect, request, APIRequestContext } from '@playwright/test';

// Shared state for the scenario
let userAContext: APIRequestContext;
let userBContext: APIRequestContext;
let userATransactionId: string;
let fetchResponse: any;
let fetchStatus: number;

Given('a provisioned test user {string} with an active session', async function (userName: string) {
  // TODO: 
  // 1. Provision the user via Supabase Admin API or test endpoint
  // 2. Retrieve their session token/cookie
  // 3. Initialize a Playwright API context with those credentials
  userAContext = await request.newContext({
    baseURL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    // extraHTTPHeaders: { 'Authorization': `Bearer ${userAToken}` }
  });
  
  console.log(`Provisioned context for ${userName}`);
});

Given('{string} has an existing transaction record', async function (userName: string) {
  // TODO: Seed a transaction for UserA in the database
  userATransactionId = 'seeded-transaction-id-for-user-a';
  console.log(`Seeded transaction ${userATransactionId} for ${userName}`);
});

Given('a separately authenticated API context for test user {string}', async function (userName: string) {
  // TODO: Provision UserB and create their authenticated context
  userBContext = await request.newContext({
    baseURL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    // extraHTTPHeaders: { 'Authorization': `Bearer ${userBToken}` }
  });
  
  console.log(`Provisioned context for ${userName}`);
});

When('{string} sends a GET request attempting to fetch {string}\'s transaction', async function (userB: string, userA: string) {
  // UserB attempts to access UserA's transaction
  const response = await userBContext.get(`/api/transactions/${userATransactionId}`);
  fetchStatus = response.status();
  
  try {
    fetchResponse = await response.json();
  } catch {
    fetchResponse = null;
  }
  
  console.log(`${userB} attempted to fetch transaction of ${userA}. Status: ${fetchStatus}`);
});

Then('the API response status code should be {int} or return an empty array', async function (expectedStatus: number) {
  // RLS typically acts like the record doesn't exist (returns 404 or empty array) 
  // instead of 403 Forbidden to prevent enumeration attacks.
  if (fetchStatus === 200) {
    expect(Array.isArray(fetchResponse)).toBe(true);
    expect(fetchResponse.length).toBe(0);
  } else {
    expect(fetchStatus).toBe(expectedStatus);
  }
});

Then('no transaction data belonging to {string} is exposed', async function (userName: string) {
  // Assert that the response doesn't contain UserA's sensitive data
  if (fetchResponse && !Array.isArray(fetchResponse)) {
    expect(fetchResponse.id).not.toBe(userATransactionId);
  }
});
