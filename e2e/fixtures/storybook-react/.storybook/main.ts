import { muirPixieStorybookViteMockTransformerPlugin } from '@muirjs/pixie-storybook-vite';
import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  framework: '@storybook/react-vite',
  addons: ['@storybook/addon-vitest'],
  // A test run sends Storybook no usage data.
  core: { disableTelemetry: true },
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      plugins: [muirPixieStorybookViteMockTransformerPlugin()],
    }),
};

export default config;
