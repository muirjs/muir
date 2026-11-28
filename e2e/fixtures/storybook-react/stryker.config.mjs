import { muirProteusReactMutators } from '@muirjs/proteus-react';
import { muirProteusStorybookMutators } from '@muirjs/proteus-storybook';

await muirProteusStorybookMutators({
  experimental: { MuirProteusStorybookArgs: true },
});
await muirProteusReactMutators();

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  mutate: ['src/**/*.tsx'],
  appendPlugins: [
    '@muirjs/shadowcat-storybook',
    '@muirjs/shadowcat-storybook-vitest',
    '@muirjs/banshee-storybook-vitest',
    '@muirjs/shadowcat-react',
  ],
  ignorers: [
    'muir-shadowcat-storybook-csf',
    'muir-shadowcat-storybook-vitest',
    'muir-shadowcat-react-styling',
  ],
  muirShadowcatStorybook: { configDir: '.storybook' },
};
