import { muirProteusReactMutators } from '@muirjs/proteus-react';

await muirProteusReactMutators();

export default {
  concurrency: 1,
  reporters: ['clear-text', 'progress', 'json'],
  plugins: ['@muirjs/siryn-playwright'],
  testRunner: 'muir-siryn-playwright',
  muirSirynPlaywright: { configFile: 'playwright.config.mjs' },
  mutate: ['app/src/app/app.tsx', 'app/src/app/price-tag.tsx'],
  coverageAnalysis: 'perTest',
  timeoutMS: 11_000,
  jsonReporter: { fileName: 'reports/mutation.json' },
};
