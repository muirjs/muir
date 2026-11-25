/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: ['src/**/*.js'],
  plugins: ['@stryker-mutator/*', '@muirjs/siryn-node-test'],
  testRunner: 'muir-siryn-node-test',
  muirSirynNodeTest: {
    testFiles: ['test/**/*.test.js'],
    nodeArgs: ['--test-only'],
  },
  reporters: ['clear-text', 'progress'],
};
