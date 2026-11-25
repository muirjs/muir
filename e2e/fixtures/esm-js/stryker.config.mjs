import { muirProteusNodeMutators } from '@muirjs/proteus-node';

await muirProteusNodeMutators();

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: ['src/**/*.js'],
  plugins: ['@stryker-mutator/*', '@muirjs/siryn-node-test'],
  testRunner: 'muir-siryn-node-test',
  muirSirynNodeTest: { testFiles: ['test/**/*.test.js'] },
  reporters: ['clear-text', 'progress'],
};
