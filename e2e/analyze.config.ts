import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './analyze',
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  outputDir: '../.next/analyze-results',
  use: { headless: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
