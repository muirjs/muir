import { defineConfig, devices } from '@playwright/test';

// Each Stryker test runner process starts its own server, on its own port.
const port = 4870 + Number(process.env['STRYKER_MUTATOR_WORKER'] ?? 0);
const url = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: 'e2e',
  // A mutant that removes the button fails a test in a second, not at the test's 30 s timeout as a Timeout.
  expect: { timeout: 1_000 },
  use: { baseURL: url, actionTimeout: 1_000 },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    url,
    reuseExistingServer: false,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
