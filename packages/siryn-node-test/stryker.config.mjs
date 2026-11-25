import base, { production, reportFiles, source } from '../../stryker.base.mjs';

export default await production(
  {
    ...base,
    mutate: ['packages/siryn-node-test/src/**/*.ts'],
    tsconfigFile: 'packages/siryn-node-test/tsconfig.stryker.json',
    incrementalFile:
      'reports/stryker-incremental/@muirjs/siryn-node-test.src.json',
    ...reportFiles('@muirjs/siryn-node-test.src'),
    muirSirynNodeTest: {
      testFiles: ['packages/siryn-node-test/test/**/*.test.ts'],
      nodeArgs: [source],
    },
  },
  { MuirProteusJsNumericLiteral: true },
);
