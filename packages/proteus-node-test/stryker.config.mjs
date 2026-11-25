import base, { production, reportFiles, source } from '../../stryker.base.mjs';

export default await production(
  {
    ...base,
    mutate: ['packages/proteus-node-test/src/**/*.ts'],
    tsconfigFile: 'packages/proteus-node-test/tsconfig.stryker.json',
    incrementalFile:
      'reports/stryker-incremental/@muirjs/proteus-node-test.src.json',
    ...reportFiles('@muirjs/proteus-node-test.src'),
    muirSirynNodeTest: {
      testFiles: ['packages/proteus-node-test/test/**/*.test.ts'],
      nodeArgs: [source],
    },
  },
  { MuirProteusJsNumericLiteral: true },
);
