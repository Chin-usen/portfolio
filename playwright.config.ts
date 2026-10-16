import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? './test-results',
  reporter: [
    ['list'],
    [
      'html',
      { open: 'never', outputFolder: process.env.PLAYWRIGHT_HTML_REPORT ?? './playwright-report' },
    ],
  ],
  use: { baseURL: 'http://127.0.0.1:4322', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm build && node scripts/serve-dist.mjs --port 4322',
    url: 'http://127.0.0.1:4322',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
