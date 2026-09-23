'use client';

import { useState } from 'react';
import QuickExpenseModal from '@/src/components/forms/QuickExpenseModal';

export default function QuickExpenseFAB({ accountId }: { accountId: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center text-3xl transition-transform active:scale-95 z-40"
        aria-label="Add Expense"
      >
        +
      </button>

      <QuickExpenseModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        accountId={accountId} 
      />
    </>
  );
}
