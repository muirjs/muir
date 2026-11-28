/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  appendPlugins: ['@muirjs/siryn-playwright'],
  testRunner: 'muir-siryn-playwright',
  muirSirynPlaywright: { configFile: 'playwright.config.mjs' },
  mutate: ['src/counter.ts'],
  coverageAnalysis: 'perTest',
  timeoutMS: 11_000,
};
