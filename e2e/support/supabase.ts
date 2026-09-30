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
