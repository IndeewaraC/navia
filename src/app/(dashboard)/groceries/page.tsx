import { createClient } from '@/src/lib/supabase/server';
import { redirect } from 'next/navigation';
import ActiveCartsList from '@/src/components/groceries/ActiveCartsList';
import PastReceiptCard from '@/src/components/groceries/PastReceiptCard';

export const metadata = {
  title: 'Groceries | Navia',
  description: 'Offline Grocery Engine & Receipt Ledger',
};

export default async function GroceriesPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  // Fetch the user's recent grocery trips
  const { data: trips } = await supabase
    .from('grocery_trips')
    .select('trip_id, store_name, trip_date, final_settled_total, receipt_items')
    .eq('user_id', user.id)
    .order('trip_date', { ascending: false })
    .limit(10);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 selection:bg-emerald-500/30">
      
      {/* Header Area */}
      <div className="px-6 pt-12 pb-6 sticky top-0 bg-slate-950/80 backdrop-blur-xl z-30 border-b border-slate-800/50">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
          Provisions
        </h1>
        <p className="text-sm font-medium text-slate-400 mt-1">
          Offline math balancer and receipt logging.
        </p>
      </div>

      <div className="px-6 py-6 space-y-8">
        
        {/* Launchpad for a New Trip */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors" />
          
          <div className="relative z-10 flex flex-col gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-3xl shadow-inner">
              🛒
            </div>
            
            <div>
              <h2 className="text-xl font-bold text-slate-100 tracking-tight">Start a Grocery Run</h2>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Draft your list, track shelf prices, and balance the receipt before hitting the checkout. Works completely offline.
              </p>
            </div>

            <ActiveCartsList />
          </div>
        </div>

        {/* Trip History */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 px-2 uppercase tracking-widest">Past Receipts</h3>
          
          <div className="space-y-3">
            {!trips || trips.length === 0 ? (
              <div className="bg-slate-950 border border-dashed border-slate-800 rounded-2xl p-8 text-center">
                <div className="text-3xl mb-2 opacity-50">🧾</div>
                <p className="text-sm font-medium text-slate-500">No grocery trips logged yet.</p>
              </div>
            ) : (
              trips.map((trip) => (
                <PastReceiptCard key={trip.trip_id} trip={trip} />
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
