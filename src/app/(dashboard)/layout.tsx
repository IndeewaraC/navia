import { redirect } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/server';
import BottomNav from '@/src/components/navigation/BottomNav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  
  // 1. Secure the Dashboard Perimeter
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30">
      {/*
        Main content area.
        Reserve the navigation height, including the device safe area.
      */}
      <main className="flex-1 pb-[calc(var(--bottom-nav-height)+2rem)]">
        {children}
      </main>

      {/* Mobile-first Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
