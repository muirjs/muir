import { muirProteusNodeTestMutators } from '@muirjs/proteus-node-test';

await muirProteusNodeTestMutators();

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: ['test/**/*.test.js'],
  plugins: ['@stryker-mutator/*', '@muirjs/siryn-node-test'],
  testRunner: 'muir-siryn-node-test',
  muirSirynNodeTest: { testFiles: ['test/**/*.test.js'] },
  reporters: ['clear-text', 'progress'],
};
