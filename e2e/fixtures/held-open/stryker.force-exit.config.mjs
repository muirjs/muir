/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: ['src/**/*.js'],
  plugins: ['@stryker-mutator/*', '@muirjs/siryn-node-test'],
  testRunner: 'lz-node-test',
  lzNodeTest: {
    testFiles: ['test/**/*.test.js'],
    nodeArgs: ['--test-force-exit'],
  },
  reporters: ['clear-text', 'progress'],
};
