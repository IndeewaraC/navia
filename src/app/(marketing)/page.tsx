import Link from 'next/link';

export default function MarketingPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] mt-20">
      
      {/* Hero Section */}
      <section className="relative px-4 py-20 md:py-32 flex flex-col items-center justify-center text-center overflow-hidden">
        
        {/* Abstract Gradient Mesh */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/20 blur-[120px] rounded-full pointer-events-none -z-10" />
        
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-8 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Early Access Available
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 max-w-4xl text-transparent bg-clip-text bg-gradient-to-br from-slate-100 to-slate-500 leading-tight">
          Your Zero-Trust <br />
          <span className="bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 text-transparent">Privacy Vault.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl font-medium leading-relaxed">
          Stop living paycheck-to-paycheck. Navia calculates your exact <span className="text-slate-200 font-bold">Survival Runway</span> through a dual-layer budgeting engine that never sells your data.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center w-full max-w-md mx-auto">
          <Link href="/login" className="w-full text-center px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-lg transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] hover:-translate-y-1">
            Open Your Vault
          </Link>
          <a href="#features" className="w-full text-center px-8 py-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-bold text-lg hover:bg-slate-800 hover:text-white transition-all">
            Explore Engine
          </a>
        </div>
        
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-24 px-4 bg-slate-950 relative border-t border-slate-900">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Engineered for Stability</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">We ripped out the complicated spreadsheets and replaced them with specialized micro-engines.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-8 rounded-3xl hover:border-emerald-500/30 transition-colors group">
              <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-black/50">
                💳
              </div>
              <h3 className="text-2xl font-bold mb-3 text-slate-100">Dual-Layer Budget</h3>
              <p className="text-slate-400 leading-relaxed">
                We strictly separate fixed bills from your daily operational spend so you never accidentally spend rent money on dinner.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-8 rounded-3xl hover:border-emerald-500/30 transition-colors group">
              <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-black/50">
                🏦
              </div>
              <h3 className="text-2xl font-bold mb-3 text-slate-100">Magic Month Router</h3>
              <p className="text-slate-400 leading-relaxed">
                Our postgres engine automatically detects the rare 3-paycheck "Magic Months" and dynamically routes the surplus into your emergency fund.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-8 rounded-3xl hover:border-emerald-500/30 transition-colors group">
              <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-black/50">
                🛒
              </div>
              <h3 className="text-2xl font-bold mb-3 text-slate-100">Offline Groceries</h3>
              <p className="text-slate-400 leading-relaxed">
                Check off items in the store even when you lose cell reception. Your data is cached locally and synchronized via background workers when you reconnect.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Security Banner */}
      <section id="security" className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-emerald-950/20 backdrop-blur-3xl -z-10" />
        <div className="max-w-4xl mx-auto text-center bg-slate-900 border border-emerald-900/50 p-12 rounded-[3rem] shadow-2xl relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/20 blur-[60px] rounded-full pointer-events-none" />
          
          <h2 className="text-3xl md:text-5xl font-black mb-6 text-slate-100 leading-tight">We don't sell your data.<br />We encrypt it.</h2>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed max-w-2xl mx-auto">
            Navia operates on a strict zero-trust architecture. Edge session validation, Postgres Row-Level Security, and Upstash rate-limiting protect your financial perimeter.
          </p>
          
          <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-slate-100 text-slate-950 font-black text-lg hover:bg-white transition-all shadow-xl hover:scale-105">
            Claim Your Vault
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>
      </section>

    </div>
  );
}
