'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ActiveCartButton() {
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    // Check if the user has an active offline draft saved
    const draft = localStorage.getItem('navia_grocery_draft_active_trip');
    if (draft && JSON.parse(draft).length > 0) {
      setHasDraft(true);
    }
  }, []);

  return (
    <Link 
      href="/groceries/active" 
      className={`mt-2 w-full inline-flex items-center justify-center py-4 rounded-xl font-bold text-sm transition-all active:scale-95 ${
        hasDraft 
          ? 'bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:bg-amber-400' 
          : 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:bg-emerald-400'
      }`}
    >
      {hasDraft ? (
        <>
          <span className="mr-2">⚡</span> Resume Saved Cart
        </>
      ) : (
        'Initialize Cart'
      )}
    </Link>
  );
}
