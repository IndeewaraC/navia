'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ActiveCart {
  tripId: string;
  storeName: string;
  lastUpdated: number;
}

export default function ActiveCartsList() {
  const [activeCarts, setActiveCarts] = useState<ActiveCart[]>([]);

  useEffect(() => {
    // Scan local storage for all active grocery drafts
    const carts: ActiveCart[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('navia_grocery_draft_')) {
        const tripId = key.replace('navia_grocery_draft_', '');
        try {
          const rawPayload = localStorage.getItem(key);
          if (rawPayload) {
            const parsed = JSON.parse(rawPayload);
            // Ignore drafts that are empty arrays or have no items
            if (Array.isArray(parsed) && parsed.length > 0) {
              carts.push({ tripId, storeName: 'Local Supermarket', lastUpdated: Date.now() });
            } else if (parsed && parsed.items && parsed.items.length > 0) {
              carts.push({ 
                tripId, 
                storeName: parsed.storeName || 'Local Supermarket', 
                lastUpdated: parsed.lastUpdated || Date.now() 
              });
            }
          }
        } catch (e) {
          console.error('Failed to parse draft key', key, e);
        }
      }
    }
    
    // Sort by most recently updated
    carts.sort((a, b) => b.lastUpdated - a.lastUpdated);
    setActiveCarts(carts);
  }, []);

  return (
    <div className="flex flex-col gap-3 mt-2">
      {activeCarts.map(cart => (
        <div key={cart.tripId} className="flex gap-2">
          <Link 
            href={`/groceries/active?tripId=${cart.tripId}`} 
            className="flex-1 inline-flex items-center justify-between py-4 px-6 rounded-xl font-bold text-sm transition-all active:scale-95 bg-amber-500/20 text-amber-400 border border-amber-500/50 hover:bg-amber-500/30"
          >
            <div className="flex items-center">
              <span className="mr-3">⚡</span> 
              Resume {cart.storeName} Cart
            </div>
            <span className="text-xs font-medium text-amber-500/70">
              {new Date(cart.lastUpdated).toLocaleDateString()}
            </span>
          </Link>
          <button 
            onClick={() => {
              localStorage.removeItem(`navia_grocery_draft_${cart.tripId}`);
              setActiveCarts(prev => prev.filter(c => c.tripId !== cart.tripId));
            }}
            className="w-14 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all active:scale-95"
            title="Discard Cart"
          >
            🗑️
          </button>
        </div>
      ))}

      {/* Always allow starting a new completely distinct cart */}
      <Link 
        href="/groceries/active" 
        className="w-full inline-flex items-center justify-center py-4 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:bg-emerald-400 transition-all active:scale-95"
      >
        {activeCarts.length > 0 ? '+ Start Another Grocery Run' : 'Initialize Cart'}
      </Link>
    </div>
  );
}
