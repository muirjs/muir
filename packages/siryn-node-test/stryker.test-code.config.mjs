import base, { reportFiles, source, testCode } from '../../stryker.base.mjs';

export default await testCode({
  ...base,
  mutate: ['packages/siryn-node-test/test/**/*.test.ts'],
  tsconfigFile: 'packages/siryn-node-test/tsconfig.stryker.json',
  incrementalFile:
    'reports/stryker-incremental/@muirjs/siryn-node-test.test-code.json',
  ...reportFiles('@muirjs/siryn-node-test.test-code'),
  muirSirynNodeTest: {
    testFiles: ['packages/siryn-node-test/test/**/*.test.ts'],
    nodeArgs: [source],
  },
});
