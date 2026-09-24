import { createClient } from '@/src/lib/supabase/server';
import { redirect } from 'next/navigation';
import GroceryChecklist from '@/src/components/groceries/GroceryChecklist';

export const metadata = {
  title: 'Active Trip | Navia',
};

export default async function ActiveGroceryTripPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> 
}) {
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

  const params = await searchParams;
  let tripIdParam = params.tripId;
  if (Array.isArray(tripIdParam)) {
    tripIdParam = tripIdParam[0];
  }
  const activeTripId = tripIdParam || `trip_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div className="min-h-screen bg-slate-950 pt-8 pb-32 px-4 sm:px-6 flex items-start justify-center">
      <GroceryChecklist 
        tripId={activeTripId}
        storeName="Local Supermarket"
        accountId={accountId}
        initialItems={[]}
      />
    </div>
  );
}
