/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: ['src/**/*.js'],
  plugins: ['@stryker-mutator/*', '@muirjs/siryn-node-test'],
  testRunner: 'lz-node-test',
  lzNodeTest: { testFiles: ['test/**/*.test.js'], nodeArgs: ['--test-only'] },
  reporters: ['clear-text', 'progress'],
};
