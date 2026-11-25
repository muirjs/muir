import base, { reportFiles, source, testCode } from '../../stryker.base.mjs';

export default await testCode({
  ...base,
  mutate: ['packages/madrox-node-test/test/**/*.test.ts'],
  tsconfigFile: 'packages/madrox-node-test/tsconfig.stryker.json',
  incrementalFile:
    'reports/stryker-incremental/@muirjs/madrox-node-test.test-code.json',
  ...reportFiles('@muirjs/madrox-node-test.test-code'),
  lzNodeTest: {
    testFiles: ['packages/madrox-node-test/test/**/*.test.ts'],
    nodeArgs: [source],
  },
});
