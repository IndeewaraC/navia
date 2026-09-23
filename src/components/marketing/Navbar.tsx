'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/80 backdrop-blur-md border-b border-slate-800 py-3' : 'bg-transparent py-5'}`}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-slate-950 font-black text-lg group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(52,211,153,0.4)]">
            N
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-100 group-hover:text-white transition-colors">Navia</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <Link href="#features" className="hover:text-emerald-400 transition-colors">Features</Link>
          <Link href="#security" className="hover:text-emerald-400 transition-colors">Security</Link>
          <Link href="#pricing" className="hover:text-emerald-400 transition-colors">Pricing</Link>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/login" className="hidden sm:block text-sm font-semibold text-slate-300 hover:text-white transition-colors">
            Log in
          </Link>
          <Link href="/login" className="px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] hover:scale-105">
            Open Vault
          </Link>
        </div>
      </div>
    </header>
  );
}
