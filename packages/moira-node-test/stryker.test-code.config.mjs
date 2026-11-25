import base, { reportFiles, source, testCode } from '../../stryker.base.mjs';

export default await testCode({
  ...base,
  mutate: ['packages/moira-node-test/test/**/*.test.ts'],
  tsconfigFile: 'packages/moira-node-test/tsconfig.stryker.json',
  incrementalFile:
    'reports/stryker-incremental/@muirjs/moira-node-test.test-code.json',
  ...reportFiles('@muirjs/moira-node-test.test-code'),
  muirSirynNodeTest: {
    testFiles: ['packages/moira-node-test/test/**/*.test.ts'],
    nodeArgs: [source],
  },
});
