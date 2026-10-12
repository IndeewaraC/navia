Run `npm run test:mobile` from the project root (on PowerShell with restricted script execution, use `npm.cmd run test:mobile`).

The suite renders the production React components and Tailwind stylesheet in a local browser harness. Next's bundled webpack and the existing TypeScript/PostCSS dependencies build the harness; no extra packages or live accounts are required. Supabase, navigation, and API responses use local fixtures. These tests verify client layout, timers, draft persistence, and submitted payloads, without writing to the live database.

Chromium and WebKit cover 320px and 390px portrait screens, a short 360px viewport, and landscape. Grocery checks use 31 items with long names, edit prices and totals, reload drafts, and save both partial prices and receipts. Expense checks exercise a scrolling form with eight accounts and a project selector, submit the form, and close/reopen the modal. Banner checks use a simulated clock to verify dismissal at 60 seconds.

Screenshots and traces are saved under `.next/mobile-layout-harness` and `.next/mobile-layout-results`.
