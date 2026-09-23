import Navbar from '@/src/components/marketing/Navbar';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 flex flex-col">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      
      <footer className="border-t border-slate-900 bg-slate-950 py-12">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Navia</span>
            <span className="text-sm text-slate-500">© {new Date().getFullYear()} Navia Inc.</span>
          </div>
          <div className="flex gap-6 text-sm font-medium text-slate-400">
            <a href="#" className="hover:text-emerald-400 transition-colors">Privacy</a>
            <a href="#" className="hover:text-emerald-400 transition-colors">Terms</a>
            <a href="#" className="hover:text-emerald-400 transition-colors">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
