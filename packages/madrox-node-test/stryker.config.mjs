import base, { production, reportFiles, source } from '../../stryker.base.mjs';

export default await production(
  {
    ...base,
    mutate: ['packages/madrox-node-test/src/**/*.ts'],
    tsconfigFile: 'packages/madrox-node-test/tsconfig.stryker.json',
    incrementalFile:
      'reports/stryker-incremental/@muirjs/madrox-node-test.src.json',
    ...reportFiles('@muirjs/madrox-node-test.src'),
    lzNodeTest: {
      testFiles: ['packages/madrox-node-test/test/**/*.test.ts'],
      nodeArgs: [source],
    },
  },
  { LzJsNumericLiteral: true },
);
