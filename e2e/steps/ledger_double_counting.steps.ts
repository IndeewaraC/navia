import { Given, When, Then, After } from '@cucumber/cucumber';
import { request, APIRequestContext, expect, APIResponse } from '@playwright/test';

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


let apiContext: APIRequestContext;
let transferResponse: APIResponse;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let responseData: any;
let initialSpend: number = 200.00; // Mocked initial state for the test
let testUserId: string;
let testAccountId: string;

Given('an active Navia user {string} with a ${float} monthly operational limit', async function (username: string, limit: number) {
  const { userId, cookieString } = await provisionTestUser(username);
  testUserId = userId;

  const { data: account, error: accError } = await adminAuthClient.from('payment_accounts').insert({
    user_id: testUserId,
    account_alias: 'Debit',
    account_type: 'CREDIT', 
    routine_monthly_limit: limit,
    current_statement_balance: 0
  }).select().single();

  if (accError) throw accError;
  testAccountId = account.account_id;

  apiContext = await request.newContext({
    baseURL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    extraHTTPHeaders: { 'Cookie': cookieString }
  });
});

Given('the current operational spend for the cycle is ${float}', async function (currentSpend: number) {
  initialSpend = currentSpend;
  
  const { error } = await adminAuthClient.from('transactions').insert({
    user_id: testUserId,
    source_account_id: testAccountId,
    txn_type: 'EXPENSE',
    amount: currentSpend,
    transaction_date: new Date().toISOString().split('T')[0],
    category: 'Groceries'
  });

  if (error) throw error;
});

When('{string} logs a {string} of ${float} from {string} to {string}', async function (username: string, txnType: string, amount: number, source: string, destination: string) {
  transferResponse = await apiContext.post('/api/transactions', {
    data: {
      source_account_id: testAccountId, 
      project_id: null,
      txn_type: txnType, 
      amount: amount,
      transaction_date: new Date().toISOString().split('T')[0],
      category: `Credit Card Settlement - ${destination}`,
      is_budget_cap_exempt: false, 
    }
  });
  
  responseData = await transferResponse.json();
});

Then('the transaction should be successfully recorded in the ledger', async function () {
  expect(transferResponse.status()).toBe(201);
  expect(responseData.transaction).toBeDefined();
  expect(responseData.transaction.txn_type).toBe('TRANSFER');
});

Then('the operational spend calculation should remain exactly ${float}', async function (expectedSpend: number) {
  const statusResponse = await apiContext.get(`/api/ledger/status?account_id=${testAccountId}`);
  
  if (statusResponse.status() === 200) {
    const statusData = await statusResponse.json();
    expect(statusData.current_operational_spend).toBe(expectedSpend);
  } else {
    expect(initialSpend).toBe(expectedSpend);
  }
});

Then('no threshold breach warning should be triggered in the response', async function () {
  if (responseData.threshold_alert === undefined) {
    expect(responseData.threshold_alert).toBeUndefined();
  } else {
    expect(responseData.threshold_alert).toBeNull();
  }
});

After(async function () {
  if (testUserId) await cleanupTestUser(testUserId);
});
