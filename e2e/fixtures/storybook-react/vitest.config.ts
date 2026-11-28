import {
  muirPixieStorybookViteMockResetPlugin,
  muirPixieStorybookViteStrykerPlugin,
} from '@muirjs/pixie-storybook-vite';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    muirPixieStorybookViteStrykerPlugin(),
    muirPixieStorybookViteMockResetPlugin(),
  ],
  test: {
    projects: [
      {
        extends: true,
        plugins: [storybookTest({ configDir: '.storybook' })],
        // Under React 16 and 17, Storybook 10.6.5 leaves its React DOM shim for Vite to find mid-run, which fails the first run.
        optimizeDeps: { include: ['@storybook/react-dom-shim'] },
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
