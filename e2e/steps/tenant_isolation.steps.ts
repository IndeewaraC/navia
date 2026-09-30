import { Given, When, Then, After } from '@cucumber/cucumber';
import { expect, request, APIRequestContext } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

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

// Shared state for the scenario
let userAContext: APIRequestContext;
let userBContext: APIRequestContext;
let userATransactionId: string;
let userAId: string;
let userBId: string;
let fetchResponse: any;
let fetchStatus: number;

Given('a provisioned test user {string} with an active session', async function (userName: string) {
  const { userId, cookieString } = await provisionTestUser(userName);
  userAId = userId;
  
  userAContext = await request.newContext({
    baseURL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    extraHTTPHeaders: { 'Cookie': cookieString }
  });
  
  console.log(`Provisioned context for ${userName}`);
});

Given('{string} has an existing transaction record', async function (userName: string) {
  // Seed a transaction for UserA in the database using admin client
  // Wait, transactions need a source_account_id which is a UUID.
  // The table is `payment_accounts`. UserA might need an account.
  // Actually, let's just create a payment account for UserA first.
  const { data: account, error: accError } = await adminAuthClient.from('payment_accounts').insert({
    user_id: userAId,
    account_alias: 'Test Account',
    account_type: 'CREDIT',
    routine_monthly_limit: 1000,
    current_statement_balance: 0
  }).select().single();
  
  if (accError) throw accError;

  const { data: txn, error: txnError } = await adminAuthClient.from('transactions').insert({
    user_id: userAId,
    source_account_id: account.account_id,
    txn_type: 'EXPENSE',
    amount: 10,
    transaction_date: '2026-09-30',
    category: 'Food'
  }).select().single();

  if (txnError) throw txnError;
  
  userATransactionId = txn.id;
  console.log(`Seeded transaction ${userATransactionId} for ${userName}`);
});

Given('a separately authenticated API context for test user {string}', async function (userName: string) {
  const { userId, cookieString } = await provisionTestUser(userName);
  userBId = userId;

  userBContext = await request.newContext({
    baseURL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    extraHTTPHeaders: { 'Cookie': cookieString }
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

After(async function () {
  if (userAId) await cleanupTestUser(userAId);
  if (userBId) await cleanupTestUser(userBId);
});

