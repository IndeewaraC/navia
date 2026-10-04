import { BeforeAll, AfterAll, Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, Browser, BrowserContext, Page } from '@playwright/test';

// Set global timeout for Cucumber steps
setDefaultTimeout(60 * 1000);

let browser: Browser;

// Declare custom properties on the World object
declare module '@cucumber/cucumber' {
  interface World {
    context: BrowserContext;
    page: Page;
    liveOtp?: string; // Used to pass the dynamic OTP across steps
  }
}

BeforeAll(async function () {
  browser = await chromium.launch({ headless: false }); // Set to true for CI
});

Before(async function () {
  this.context = await browser.newContext();
  
  // Start Playwright Tracing for the visual editor
  await this.context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  
  this.page = await this.context.newPage();
});

After(async function ({ pickle, result }) {
  // If the scenario failed, save the trace!
  if (result?.status === 'FAILED') {
    const traceName = pickle.name.replace(/[^a-zA-Z0-9]/g, '_');
    await this.context.tracing.stop({ path: `traces/${traceName}-trace.zip` });
  } else {
    // Otherwise just stop tracing and discard it
    await this.context.tracing.stop();
  }

  await this.page?.close();
  await this.context?.close();
});

AfterAll(async function () {
  await browser?.close();
});
