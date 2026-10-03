'use client';

import { useState, useEffect } from 'react';

export default function MagicMonthBanner({ isMagicMonth }: { isMagicMonth: boolean }) {
  // Initialize visibility strictly based on whether it is a magic month
  const [isVisible, setIsVisible] = useState(isMagicMonth);

  useEffect(() => {
    // If it's not a magic month, do nothing
    if (!isVisible) return;

    // Set a timer to dismiss the banner after 3 minutes (180,000 ms)
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 3 * 60 * 1000);

    // Cleanup timer if the component unmounts early
    return () => clearTimeout(timer);
  }, [isVisible]);

  // If the timer has popped or it's not a magic month, render nothing
  if (!isVisible) return null;

  return (
    <div className="bg-[#0f0e26] border border-indigo-500/20 rounded-2xl p-6 shadow-xl mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">✨</span>
        <h2 className="text-xl font-bold text-slate-100">Magic Month Detected</h2>
      </div>
      <p className="text-slate-300 text-sm leading-relaxed">
        You receive 3 paychecks this month. Route the surplus to your emergency fund to accelerate your financial goals.
      </p>
    </div>
  );
}
