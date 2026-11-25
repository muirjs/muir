import base, { reportFiles, source, testCode } from '../../stryker.base.mjs';

export default await testCode({
  ...base,
  mutate: ['packages/proteus-node/test/**/*.test.ts'],
  tsconfigFile: 'packages/proteus-node/tsconfig.stryker.json',
  incrementalFile:
    'reports/stryker-incremental/@muirjs/proteus-node.test-code.json',
  ...reportFiles('@muirjs/proteus-node.test-code'),
  muirSirynNodeTest: {
    testFiles: ['packages/proteus-node/test/**/*.test.ts'],
    nodeArgs: [source],
  },
});
