import { lzJsxMutators } from '@muirjs/proteus-jsx';

await lzJsxMutators();

export default {
  concurrency: 1,
  reporters: ['clear-text', 'progress', 'json'],
  plugins: ['@muirjs/siryn-playwright'],
  testRunner: 'lz-playwright',
  lzPlaywright: { configFile: 'playwright.config.mjs' },
  mutate: ['app/src/app/app.tsx', 'app/src/app/price-tag.tsx'],
  coverageAnalysis: 'perTest',
  timeoutMS: 11_000,
  jsonReporter: { fileName: 'reports/mutation.json' },
};
