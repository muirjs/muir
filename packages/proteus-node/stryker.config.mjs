import base, { production, reportFiles, source } from '../../stryker.base.mjs';

export default await production(
  {
    ...base,
    // The synthetic sample is code that exists to be mutated by the production mutators.
    mutate: [
      'packages/proteus-node/src/**/*.ts',
      'packages/proteus-node/test/synthetic/node-apis.ts',
    ],
    tsconfigFile: 'packages/proteus-node/tsconfig.stryker.json',
    incrementalFile:
      'reports/stryker-incremental/@muirjs/proteus-node.src.json',
    ...reportFiles('@muirjs/proteus-node.src'),
    muirSirynNodeTest: {
      testFiles: ['packages/proteus-node/test/**/*.test.ts'],
      nodeArgs: [source],
    },
  },
  { MuirProteusJsNumericLiteral: true },
);
