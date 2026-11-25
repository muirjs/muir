import base, { reportFiles, source, testCode } from '../../stryker.base.mjs';

export default await testCode({
  ...base,
  mutate: ['packages/proteus-node-test/test/**/*.test.ts'],
  tsconfigFile: 'packages/proteus-node-test/tsconfig.stryker.json',
  incrementalFile:
    'reports/stryker-incremental/@muirjs/proteus-node-test.test-code.json',
  ...reportFiles('@muirjs/proteus-node-test.test-code'),
  lzNodeTest: {
    testFiles: ['packages/proteus-node-test/test/**/*.test.ts'],
    nodeArgs: [source],
  },
});
