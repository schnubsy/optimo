import { defineConfig, devices } from '@playwright/test';

// Gauntlet starts `vite preview` on 4173 itself; when run standalone, webServer below does.
const PORT = Number(process.env.PORT ?? 4173);

// Cloud mode (arc 7): a cloud session has no WebKit and an older Chromium than this Playwright pins, and cannot download
// browsers. When PW_CHROMIUM is set (scripts/gauntlet.sh sets it automatically when it finds /opt/pw-browsers), both
// projects run on that Chromium; the iPhone project keeps the iPhone 15 viewport, touch and DPR but on Chromium, not
// WebKit. Real-Safari checks then stay on Mark's phone (HANDOFF names them).
const CLOUD_CHROMIUM = process.env.PW_CHROMIUM;
const cloud = (use: Record<string, unknown>) =>
  CLOUD_CHROMIUM ? { ...use, browserName: 'chromium' as const, launchOptions: { executablePath: CLOUD_CHROMIUM } } : use;

export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.ts',
  timeout: 60_000,
  retries: 0,
  // PW_WORKERS caps parallelism when the machine is shared (another project's browsers or a backup running) — context
  // teardown and DevTools timeouts under contention are load, not product failures. Default: Playwright's own.
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : undefined,
  reporter: [['line'], ['html', { open: 'never', outputFolder: 'docs/evidence/playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}/optimo/`,
    trace: 'retain-on-failure',
    // Routing (the hermetic Supabase fake) cannot see requests from SW-controlled pages in WebKit, so SWs are off
    // by default and allowed only where the SW is the subject (tests/offline.spec.ts, Chromium).
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: cloud({ ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }) },
    { name: 'iphone-15', use: cloud({ ...devices['iPhone 15'] }) },
  ],
  webServer: process.env.GAUNTLET
    ? undefined
    : { command: `npx vite preview --port ${PORT} --strictPort`, url: `http://localhost:${PORT}/optimo/`, reuseExistingServer: true },
});
