'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function MagicMonthBanner({ isMagicMonth }: { isMagicMonth: boolean }) {
  // Initialize visibility strictly based on whether it is a magic month
  const [isVisible, setIsVisible] = useState(isMagicMonth);

  useEffect(() => {
    // If it's not a magic month, do nothing
    if (!isVisible || !isMagicMonth) return;

    // Dismiss the notice after one minute on screen.
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 60 * 1000);

    // Cleanup timer if the component unmounts early
    return () => clearTimeout(timer);
  }, [isVisible, isMagicMonth]);

  // If the timer has popped or it's not a magic month, render nothing
  if (!isVisible || !isMagicMonth) return null;

  return (
    <div className="bg-[#0f0e26] border border-indigo-500/20 rounded-2xl p-6 shadow-xl mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">✨</span>
        <h2 className="text-xl font-bold text-slate-100">Magic Month Detected</h2>
      </div>
      <p className="text-slate-300 text-sm leading-relaxed">
        You receive 3 paychecks this month. Route the surplus to your emergency fund to accelerate your financial goals.
      </p>
      <Link href="/vault" className="mt-4 inline-flex items-center justify-center px-6 py-3 rounded-xl bg-indigo-500 text-slate-50 font-bold text-sm hover:bg-indigo-400 transition-colors">
        Route Funds
      </Link>
    </div>
  );
}
