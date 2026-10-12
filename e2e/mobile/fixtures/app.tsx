import { createRoot } from 'react-dom/client';
import GroceryChecklist from '../../../src/components/groceries/GroceryChecklist';
import MagicMonthBanner from '../../../src/components/dashboard/MagicMonthBanner';
import EarlyCycleWarnings from '../../../src/components/dashboard/EarlyCycleWarnings';
import QuickExpenseFAB from '../../../src/components/dashboard/QuickExpenseFAB';
import BottomNav from '../../../src/components/navigation/BottomNav';

const accounts = Array.from({ length: 8 }, (_, i) => ({
  account_id: `account-${i}`, account_alias: `Funding account ${i + 1}`,
}));
const initialItems: [] = [];
const groceries = window.location.pathname.includes('/groceries');

createRoot(document.getElementById('root')!).render(
  <>
    <main className="pb-[calc(var(--bottom-nav-height)+2rem)]">
      {groceries ? (
        <div className="pt-8 pb-32 px-4 sm:px-6">
          <GroceryChecklist tripId="mobile-regression" storeName="Mobile test store" accountId="account-0" initialItems={initialItems} />
        </div>
      ) : (
        <div className="p-4 max-w-xl mx-auto">
          <MagicMonthBanner isMagicMonth={!window.location.search.includes('normal')} />
          <EarlyCycleWarnings userId="fixture-user" />
          <QuickExpenseFAB paymentAccounts={accounts} activeProjects={[{ project_id: 'project-1', name: 'Emergency fund' }]} />
        </div>
      )}
    </main>
    <BottomNav />
  </>,
);
