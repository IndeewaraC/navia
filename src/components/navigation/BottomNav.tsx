'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  // Route paths adjusted to match the `(dashboard)` route group namespace without a `/dashboard` prefix
  const navItems = [
    { name: 'Ledger', href: '/ledger', icon: '💳' },
    { name: 'Groceries', href: '/groceries', icon: '🛒' },
    { name: 'Vault', href: '/vault', icon: '🏦' }, 
    { name: 'Settings', href: '/settings', icon: '⚙️' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 pb-safe">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/ledger' && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 ${
                isActive 
                  ? 'text-emerald-400 scale-105' 
                  : 'text-slate-500 hover:text-slate-300 hover:scale-105'
              }`}
            >
              <span className={`text-xl transition-transform ${isActive ? '-translate-y-0.5' : ''}`}>
                {item.icon}
              </span>
              <span className="text-[10px] font-bold tracking-wider uppercase">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
