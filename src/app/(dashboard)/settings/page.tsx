'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/client';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [anchorDate, setAnchorDate] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
        const { data: profile } = await supabase
          .from('profiles')
          .select('anchor_pay_date')
          .eq('id', user.id)
          .single();
        
        if (profile?.anchor_pay_date) {
          setAnchorDate(profile.anchor_pay_date);
        }
      }
    }
    loadProfile();
  }, [supabase]);

  const handleSaveAnchorDate = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      await supabase
        .from('profiles')
        .update({ anchor_pay_date: anchorDate })
        .eq('id', user.id);
    }
    setLoading(false);
    alert('Pay cycle anchor date updated successfully.');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-32 selection:bg-emerald-500/30">
      
      {/* Header Area */}
      <div className="px-6 pt-12 pb-6 sticky top-0 bg-slate-950/80 backdrop-blur-xl z-30 border-b border-slate-800/50">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
          Settings
        </h1>
        <p className="text-sm font-medium text-slate-400 mt-1">
          {userEmail || 'Loading Profile...'}
        </p>
      </div>

      <div className="px-6 py-6 space-y-8">
        
        {/* Engine Configuration */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl shadow-inner">
              ⚙️
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Engine Configuration</h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Core calculation variables</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Anchor Pay Date
              </label>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                The date of your first paycheck. Navia uses this to calculate your floating 14-day cycles and intelligently predict Magic Months.
              </p>
              <input
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors"
              />
            </div>

            <button
              onClick={handleSaveAnchorDate}
              disabled={loading}
              className="w-full flex items-center justify-center rounded-xl bg-slate-800 text-slate-100 font-bold py-3 px-4 hover:bg-slate-700 transition-colors border border-slate-700 hover:border-slate-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* Security / Logout */}
        <div className="pt-8">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold py-4 px-4 hover:bg-red-500/20 hover:border-red-500/30 transition-all active:scale-95"
          >
            <span className="text-xl">🔒</span> Securely Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}
