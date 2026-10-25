import { createRoot } from 'react-dom/client';
import AnalyzePage from '../../../src/app/(dashboard)/analyze/page';
import BottomNav from '../../../src/components/navigation/BottomNav';

createRoot(document.getElementById('root')!).render(
  <>
    <main className="pb-[calc(var(--bottom-nav-height)+2rem)]"><AnalyzePage /></main>
    <BottomNav />
  </>,
);
