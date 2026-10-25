import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Only server route handlers may import this client. They must authenticate the
// session and scope every operation to that user's ID before accessing data.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Receipt management is unavailable.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
