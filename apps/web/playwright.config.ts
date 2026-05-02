/**
 * Playwright config — marketing funnel smoke.
 *
 * Boots a production-mode `next start` (so we catch bundle/env regressions
 * that `next dev` would mask) and runs Chromium-only against /pricing
 * and / to keep CI under a couple of minutes.
 *
 * The webServer block reuses any already-running server on port 3000;
 * locally a developer can `pnpm dev` once and iterate on the spec
 * without rebuilding between runs.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Boot `next start` from the already-built `apps/web` workspace. The
  // build itself is run in a separate CI step before playwright is
  // invoked so the same compiled output is reused.
  webServer: {
    command: 'pnpm start',
    cwd: '.',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
