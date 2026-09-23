const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY 
);

async function createAccount() {
  console.log('Fetching users...');
  const { data: users } = await supabase.auth.admin.listUsers();
  
  if (users?.users?.length > 0) {
    const userId = users.users[0].id;
    
    const { data, error } = await supabase
      .from('payment_accounts')
      .insert({
        user_id: userId,
        account_alias: 'Primary Checking',
        account_type: 'DEBIT',
        current_statement_balance: 10000.00,
        routine_monthly_limit: 1000
      })
      .select();

    console.log('Error:', error);
    console.log('Created Account:', data);
  }
}

createAccount();
