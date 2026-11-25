import { muirProteusNodeMutators } from '@muirjs/proteus-node';

await muirProteusNodeMutators();

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: ['src/**/*.ts'],
  plugins: ['@stryker-mutator/*', '@muirjs/siryn-node-test'],
  testRunner: 'muir-siryn-node-test',
  muirSirynNodeTest: { testFiles: ['test/**/*.test.ts'], maxMemoryMB: 300 },
  checkers: ['typescript'],
  reporters: ['clear-text', 'progress'],
};
