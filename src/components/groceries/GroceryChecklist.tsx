'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOfflineGroceryDraft, GroceryItem } from '@/src/hooks/useOfflineGroceryDraft';
import { calculateGroceryTotal } from '@/src/lib/groceryPricing';

interface GroceryChecklistProps {
  tripId: string;
  storeName: string;
  initialItems: GroceryItem[];
}

export default function GroceryChecklist({ tripId, storeName, initialItems }: GroceryChecklistProps) {
  const router = useRouter();
  const { items, storeName: draftStoreName, updateStoreName, updateItem, addItem, removeItem, saveDraft, clearDraft, isOffline, rawSubtotal, pricing, updatePricing } = useOfflineGroceryDraft(tripId, initialItems, storeName);
  
  const { taxAndFees, discounts, manualTotal } = pricing;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newItemName, setNewItemName] = useState('');

  const { total: finalTotal, error: pricingError } = calculateGroceryTotal(items, taxAndFees, discounts, manualTotal);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    addItem(newItemName.trim());
    setNewItemName('');
  };

  const handleLater = () => {
    setError('');
    try {
      if (newItemName.trim()) {
        setNewItemName('');
        addItem(newItemName.trim());
      }
      saveDraft();
    } catch {
      setError('Unable to save your grocery list on this device. Please try again before leaving.');
      return;
    }
    router.push('/groceries');
  };

  const handleCheckout = async () => {
    if (pricingError) {
      setError(pricingError);
      return;
    }
    if (isOffline) {
      setError('You are currently offline. Data is saved locally. Please connect to a network to finalize checkout.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/groceries/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_name: draftStoreName || 'Unnamed Store',
          trip_date: new Date().toISOString().split('T')[0],
          raw_subtotal: rawSubtotal,
          tax_and_fees: taxAndFees,
          discount_amount: discounts,
          final_settled_total: finalTotal,
          total_mode: manualTotal !== null ? 'manual' : finalTotal !== null ? 'calculated' : 'unknown',
          items: items // Send items to update their status (e.g., rollover unchecked items)
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      clearDraft();
      router.push('/groceries');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden font-sans text-slate-100 selection:bg-indigo-500/30">
      
      {/* Header & Connectivity Status */}
      <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1 min-w-0 w-full">
          <input 
            type="text"
            value={draftStoreName}
            onChange={(e) => updateStoreName(e.target.value)}
            className="text-2xl font-bold tracking-tight text-slate-100 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-emerald-400 focus:outline-none transition-colors w-full pb-1"
            placeholder="Name this grocery run..."
          />
          <p className="text-sm text-slate-400 font-medium mt-1">Live Cart</p>
        </div>
        <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border ${isOffline ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
          {isOffline ? (
            <>
              <span className="mr-2">⚡</span> Offline (Saved)
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span> Online
            </>
          )}
        </div>
      </div>

      {/* Interactive Checklist */}
      <div className="p-4 sm:p-6 space-y-4 max-h-[50dvh] overflow-y-auto" aria-label="Grocery items">
        {items.map((item) => (
          <div 
            key={item.id} 
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-xl border transition-all duration-200 ${item.isChecked ? 'bg-slate-900 border-indigo-500/30' : 'bg-slate-950/50 border-slate-800'}`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <input 
                type="checkbox"
                aria-label={`Purchased ${item.name}`}
                checked={item.isChecked}
                onChange={(e) => updateItem(item.id, { isChecked: e.target.checked })}
                className="w-6 h-6 shrink-0 rounded border-slate-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 bg-slate-950 cursor-pointer transition-colors"
              />
              <span className={`min-w-0 [overflow-wrap:anywhere] font-medium transition-colors ${item.isChecked ? 'text-slate-100' : 'text-slate-400'}`}>
                {item.name}
              </span>
            </div>
            <div className="flex items-center gap-2 min-w-0 sm:shrink-0">
              <span className="text-slate-400 font-bold">$</span>
              <input 
                type="number"
                aria-label={`Price for ${item.name}`}
                step="0.01"
                min="0"
                value={item.shelfPrice || ''}
                onChange={(e) => {
                  updateItem(item.id, { shelfPrice: parseFloat(e.target.value) || 0 });
                }}
                inputMode="decimal"
                className="w-full min-w-0 sm:w-28 pl-3 pr-2 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-base focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors"
                placeholder="0.00"
              />
              <button 
                onClick={() => removeItem(item.id)}
                className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors ml-1"
                aria-label={`Remove ${item.name}`}
                title="Remove item"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-8 text-slate-500 font-medium">
            No items in your cart yet.
          </div>
        )}
      </div>
        
        {/* Add New Item Form */}
        <form onSubmit={handleAddItem} className="flex gap-2 px-4 pb-4 sm:px-6 sm:pb-6">
          <input
            type="text"
            aria-label="New grocery item"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Add new item..."
            className="flex-1 min-w-0 w-full px-3 py-3 bg-slate-950 border border-slate-700 rounded-xl text-base text-slate-100 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors"
          />
          <button 
            type="submit"
            disabled={!newItemName.trim()}
            className="shrink-0 px-4 py-3 bg-slate-800 text-emerald-400 font-bold rounded-xl border border-slate-700 hover:bg-slate-700 hover:border-slate-600 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </form>

      {/* Checkout Terminal */}
      <div className="p-4 sm:p-6 bg-slate-950 border-t border-slate-800 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400 font-medium">Subtotal</span>
          <span className="font-bold text-slate-200">${rawSubtotal.toFixed(2)}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400 font-medium">Taxes & Fees</span>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">$</span>
            <input 
              type="number"
              step="0.01"
              min="0"
              value={taxAndFees || ''}
              aria-label="Taxes and fees"
              onChange={(e) => updatePricing({ taxAndFees: parseFloat(e.target.value) || 0, manualTotal: null })}
              className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-right text-slate-100 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-colors"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-emerald-500/80 font-medium">Discounts</span>
          <div className="flex items-center gap-1">
            <span className="text-emerald-500/50">-$</span>
            <input 
              type="number"
              step="0.01"
              min="0"
              value={discounts || ''}
              aria-label="Discounts"
              onChange={(e) => updatePricing({ discounts: parseFloat(e.target.value) || 0, manualTotal: null })}
              className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-right text-emerald-400 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors placeholder:text-emerald-900"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-3 items-center justify-between">
          <span className="text-lg font-bold text-slate-100">Final Total</span>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">$</span>
            <input
              aria-label="Final total"
              type="number"
              step="0.01"
              min="0"
              value={finalTotal ?? ''}
              onChange={(e) => updatePricing({ manualTotal: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="Not entered"
              className="w-36 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-right text-xl placeholder:text-sm font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
            />
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Enter a total or price every item to calculate it automatically. Lists with more than two items can be saved with partial prices and no total.
        </p>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium flex items-start gap-3">
            <span className="mt-0.5">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={loading || isOffline}
          className={`mt-6 w-full flex items-center justify-center rounded-xl font-bold py-4 px-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            finalTotal !== null
              ? 'bg-indigo-600 text-slate-100 hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.15)] hover:shadow-[0_0_25px_rgba(79,70,229,0.3)]'
              : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-600/30'
          }`}
        >
          {loading ? (
             <>
               <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
               Settling Receipt...
             </>
          ) : finalTotal !== null ? (
            'Save Receipt'
          ) : (
            'Save Prices Without Total'
          )}
        </button>
        <button
          type="button"
          onClick={handleLater}
          disabled={loading}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-bold text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Later
        </button>
        <p className="text-center text-xs text-slate-400">
          Save this list on this device and resume it from the groceries page.
        </p>
      </div>

    </div>
  );
}
