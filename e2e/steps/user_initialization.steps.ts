import { Given, Then, After } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminAuthClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function provisionTestUser(userName: string, baseEmail?: string) {
  let email: string;
  if (baseEmail && baseEmail.includes('@')) {
    // Convert 'example@gmail.com' to 'example+standarduser_12345@gmail.com'
    const [localPart, domain] = baseEmail.split('@');
    email = `${localPart}+${userName.toLowerCase()}_${Date.now()}@${domain}`;
  } else {
    email = `test-${userName}-${Date.now()}@example.com`;
  }
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

async function cleanupTestUser(userId: string) {
  await adminAuthClient.auth.admin.deleteUser(userId);
}
import * as fs from 'fs';
import * as path from 'path';

Given('I initialize the test user {string} from the global fixture', async function (userKey: string) {
  // 1. Read the global JSON fixture dynamically
  const fixturePath = path.resolve(process.cwd(), 'e2e/fixtures/testUsers.json');
  const fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const userData = fixtureData[userKey];
  
  if (!userData) {
    throw new Error(`User configuration for "${userKey}" not found in testUsers.json`);
  }

  // 2. Provision the Auth User (dynamically creates an email using the JSON prefix)
  const baseEmail = userData.emailAliasPrefix;
  const { userId, cookieString } = await provisionTestUser(userKey, baseEmail);
  this.testUserId = userId;
  this.cookieString = cookieString;

  // 3. Provision the Payment Accounts based on the JSON Array
  for (const acc of userData.paymentOptions) {
    const { error } = await adminAuthClient.from('payment_accounts').insert({
      user_id: this.testUserId,
      account_alias: acc.account_alias,
      account_type: acc.account_type,
      current_statement_balance: acc.current_statement_balance,
      routine_monthly_limit: acc.routine_monthly_limit || null
    });
    
    if (error) throw new Error(`Failed to insert account ${acc.account_alias}: ${error.message}`);
  }
});

Then('the user should have {int} payment accounts created in the database', async function (count: number) {
  const { data, error } = await adminAuthClient
    .from('payment_accounts')
    .select('*')
    .eq('user_id', this.testUserId);
    
  if (error) throw error;
  expect(data).toHaveLength(count);
});

Then('the {string} account should have a balance of ${float}', async function (alias: string, expectedBalance: number) {
  const { data, error } = await adminAuthClient
    .from('payment_accounts')
    .select('*')
    .eq('user_id', this.testUserId)
    .eq('account_alias', alias)
    .single();
    
  if (error) throw error;
  expect(data.current_statement_balance).toBe(expectedBalance);
});

Then('the {string} account should have a monthly limit of ${float}', async function (alias: string, expectedLimit: number) {
  const { data, error } = await adminAuthClient
    .from('payment_accounts')
    .select('*')
    .eq('user_id', this.testUserId)
    .eq('account_alias', alias)
    .single();
    
  if (error) throw error;
  expect(data.routine_monthly_limit).toBe(expectedLimit);
});

After(async function () {
  // Leverage the ON DELETE CASCADE strategy we discussed
  if (this.testUserId) {
    await cleanupTestUser(this.testUserId);
  }
});
