import { createClient } from '@/src/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

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
    .select('trip_id, store_name, trip_date, final_settled_total')
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

            <Link 
              href="/groceries/active" 
              className="mt-2 w-full inline-flex items-center justify-center py-4 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:bg-emerald-400 transition-all active:scale-95"
            >
              Initialize Cart
            </Link>
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
                <div key={trip.trip_id} className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-lg shadow-inner">
                      🧾
                    </div>
                    <div>
                      <div className="font-bold text-slate-200">{trip.store_name}</div>
                      <div className="text-xs font-medium text-slate-500">{new Date(trip.trip_date).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="font-bold text-emerald-400">${Number(trip.final_settled_total).toFixed(2)}</div>
                    <div className="text-[10px] font-bold tracking-widest uppercase text-slate-600">Settled</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
