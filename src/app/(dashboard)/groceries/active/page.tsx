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

  // Grocery receipts track prices independently of the user's payment accounts.
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
        initialItems={[]}
      />
    </div>
  );
}
