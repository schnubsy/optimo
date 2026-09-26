import { defineConfig, devices } from '@playwright/test';

// Gauntlet starts `vite preview` on 4173 itself; when run standalone, webServer below does.
const PORT = Number(process.env.PORT ?? 4173);

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  reporter: [['line'], ['html', { open: 'never', outputFolder: 'docs/evidence/playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}/optimo/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'iphone-15', use: { ...devices['iPhone 15'] } },
  ],
  webServer: process.env.GAUNTLET
    ? undefined
    : { command: `npx vite preview --port ${PORT} --strictPort`, url: `http://localhost:${PORT}/optimo/`, reuseExistingServer: true },
});
