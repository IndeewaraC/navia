import { defineConfig } from '@playwright/test';

// Tests render the real components with local service fixtures; no account or
// live database is required to reproduce narrow-screen layout failures.
export default defineConfig({
  testDir: './mobile',
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  outputDir: '../.next/mobile-layout-results',
  use: { headless: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
