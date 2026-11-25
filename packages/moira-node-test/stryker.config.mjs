import base, { production, reportFiles, source } from '../../stryker.base.mjs';

export default await production(
  {
    ...base,
    mutate: ['packages/moira-node-test/src/**/*.ts'],
    tsconfigFile: 'packages/moira-node-test/tsconfig.stryker.json',
    incrementalFile:
      'reports/stryker-incremental/@muirjs/moira-node-test.src.json',
    ...reportFiles('@muirjs/moira-node-test.src'),
    muirSirynNodeTest: {
      testFiles: ['packages/moira-node-test/test/**/*.test.ts'],
      nodeArgs: [source],
    },
  },
  { MuirProteusJsNumericLiteral: true },
);
