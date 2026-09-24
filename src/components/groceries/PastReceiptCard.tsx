'use client';

import { useState } from 'react';

type Trip = {
  trip_id: string;
  store_name: string;
  trip_date: string;
  final_settled_total: number;
  receipt_items?: any[];
};

export default function PastReceiptCard({ trip }: { trip: Trip }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div 
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 hover:bg-slate-800/50 transition-colors cursor-pointer active:scale-[0.98]"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-lg shadow-inner">
            🧾
          </div>
          <div>
            <div className="font-bold text-slate-200">{trip.store_name}</div>
            <div suppressHydrationWarning className="text-xs font-medium text-slate-500">{new Date(trip.trip_date).toLocaleDateString()}</div>
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="font-bold text-emerald-400">${Number(trip.final_settled_total).toFixed(2)}</div>
          <div className="text-[10px] font-bold tracking-widest uppercase text-slate-600">Settled</div>
        </div>
      </div>

      {/* Modal overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-slate-100">{trip.store_name}</h3>
                <p suppressHydrationWarning className="text-sm text-slate-400">{new Date(trip.trip_date).toLocaleDateString()}</p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {trip.receipt_items && trip.receipt_items.length > 0 ? (
                trip.receipt_items.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center text-sm border-b border-slate-800/50 pb-2 last:border-0 last:pb-0">
                    <span className="text-slate-300 font-medium">{item.name}</span>
                    <span className="text-slate-100 font-bold">${Number(item.shelfPrice || 0).toFixed(2)}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 font-medium">
                  No itemized breakdown available for this receipt.
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-950">
              <div className="flex justify-between items-center text-lg font-black">
                <span className="text-slate-100">Total Settled</span>
                <span className="text-emerald-400">${Number(trip.final_settled_total).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
