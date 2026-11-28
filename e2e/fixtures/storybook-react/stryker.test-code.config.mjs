import { muirProteusMswMutators } from '@muirjs/proteus-msw';
import { muirProteusStorybookTestMutators } from '@muirjs/proteus-storybook-test';

await muirProteusStorybookTestMutators();
await muirProteusMswMutators();

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  mutate: ['src/**/*.stories.tsx'],
  appendPlugins: [
    '@muirjs/shadowcat-storybook',
    '@muirjs/shadowcat-storybook-vitest',
    '@muirjs/banshee-storybook-vitest',
  ],
  ignorers: ['muir-shadowcat-storybook-csf', 'muir-shadowcat-storybook-vitest'],
  muirShadowcatStorybook: { configDir: '.storybook' },
  muirShadowcatStorybookCsf: { play: 'mutate' },
};
