import base, { reportFiles, source, testCode } from '../../stryker.base.mjs';

export default await testCode({
  ...base,
  mutate: ['packages/proteus-js/test/**/*.test.ts'],
  tsconfigFile: 'packages/proteus-js/tsconfig.stryker.json',
  incrementalFile:
    'reports/stryker-incremental/@muirjs/proteus-js.test-code.json',
  ...reportFiles('@muirjs/proteus-js.test-code'),
  muirSirynNodeTest: {
    testFiles: ['packages/proteus-js/test/**/*.test.ts'],
    nodeArgs: [source],
  },
});
