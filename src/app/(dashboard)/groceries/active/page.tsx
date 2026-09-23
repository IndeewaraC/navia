import { createClient } from '@/src/lib/supabase/server';
import { redirect } from 'next/navigation';
import GroceryChecklist from '@/src/components/groceries/GroceryChecklist';

export const metadata = {
  title: 'Active Trip | Navia',
};

export default async function ActiveGroceryTripPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  // Fetch the primary checking account to link the receipt to
  let { data: account } = await supabase
    .from('payment_accounts')
    .select('account_id, account_alias')
    .eq('user_id', user.id)
    .ilike('account_alias', '%checking%')
    .limit(1)
    .single();

  let accountId = account?.account_id;

  // Auto-create a default checking account if the user doesn't have one (for new users)
  if (!accountId) {
    const { data: newAccount } = await supabase
      .from('payment_accounts')
      .insert({
        user_id: user.id,
        account_alias: 'Primary Checking',
        account_type: 'DEBIT',
        current_statement_balance: 5000.00
      })
      .select('account_id')
      .single();
    
    accountId = newAccount?.account_id || '00000000-0000-0000-0000-000000000000';
  }

  // Generate a mock trip ID for local session
  const mockTripId = `trip_${Date.now()}`;

  // Pre-seed some items to demonstrate the offline functionality
  const initialItems = [
    { id: 'item1', name: 'Almond Milk (Unsweetened)', shelfPrice: 0, isChecked: false },
    { id: 'item2', name: 'Free-Range Eggs (12-pack)', shelfPrice: 0, isChecked: false },
    { id: 'item3', name: 'Avocados (Bag of 5)', shelfPrice: 0, isChecked: false },
    { id: 'item4', name: 'Sourdough Bread', shelfPrice: 0, isChecked: false },
    { id: 'item5', name: 'Organic Spinach', shelfPrice: 0, isChecked: false },
  ];

  return (
    <div className="min-h-screen bg-slate-950 pt-8 pb-32 px-4 sm:px-6 flex items-start justify-center">
      <GroceryChecklist 
        tripId={mockTripId}
        storeName="Local Supermarket"
        accountId={accountId}
        initialItems={initialItems}
      />
    </div>
  );
}
