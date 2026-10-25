import { createRoot } from 'react-dom/client';
import GroceryChecklist from '../../../src/components/groceries/GroceryChecklist';
import MagicMonthBanner from '../../../src/components/dashboard/MagicMonthBanner';
import EarlyCycleWarnings from '../../../src/components/dashboard/EarlyCycleWarnings';
import QuickExpenseFAB from '../../../src/components/dashboard/QuickExpenseFAB';
import BottomNav from '../../../src/components/navigation/BottomNav';
import { getPayCycleStatus } from '../../../src/lib/payCycleDates';
import SettingsPage from '../../../src/app/(dashboard)/settings/page';
import PastReceiptCard from '../../../src/components/groceries/PastReceiptCard';
import VaultClient from '../../../src/components/vault/VaultClient';

const accounts = Array.from({ length: 8 }, (_, i) => ({
  account_id: `account-${i}`, account_alias: `Funding account ${i + 1}`,
}));
const initialItems: [] = [];
const groceries = window.location.pathname.includes('/groceries');
const settings = window.location.pathname === '/settings';
const receipt = window.location.pathname === '/groceries/receipt-test';
const vault = window.location.pathname === '/vault';
const savedProjectAmount = Number(localStorage.getItem('navia-project-service-fixture') || 0);

createRoot(document.getElementById('root')!).render(
  <>
    <main className="pb-[calc(var(--bottom-nav-height)+2rem)]">
      {settings ? <SettingsPage /> : vault ? (
        <VaultClient vaultAccount={{ current_statement_balance: 0 }} initialProjects={[{
          project_id: '00000000-0000-4000-8000-000000000002', name: 'ISTQB',
          target_amount: 250, saved_amount: savedProjectAmount, icon: '🎯',
        }]} />
      ) : receipt ? (
        <div className="p-4"><PastReceiptCard trip={{
          trip_id: 'fixture-receipt', store_name: 'costco-20/10', trip_date: '2026-10-20',
          final_settled_total: 20, receipt_items: [{ id: 'oliveoil', name: 'Olive oil', shelfPrice: 20 }],
        }} /></div>
      ) : groceries ? (
        <div className="pt-8 pb-32 px-4 sm:px-6">
          <GroceryChecklist tripId="mobile-regression" storeName="Mobile test store" initialItems={initialItems} />
        </div>
      ) : (
        <div className="p-4 max-w-xl mx-auto">
          <MagicMonthBanner isMagicMonth={!window.location.search.includes('normal')} />
          <EarlyCycleWarnings cycle={getPayCycleStatus('2026-09-18', new Date('2026-09-28T18:00:00Z'))} />
          <QuickExpenseFAB paymentAccounts={accounts} activeProjects={[{ project_id: 'project-1', name: 'Emergency fund' }]} />
        </div>
      )}
    </main>
    <BottomNav />
  </>,
);
