import { lzJsMutators } from '@muirjs/proteus-js';

import base, { production, reportFiles, source } from '../../stryker.base.mjs';

// The shared production config installs none of this package's mutators; the package's own code gets all of them.
await lzJsMutators({ extended: true, experimental: true });

export default await production({
  ...base,
  // The synthetic sample is code that exists to be mutated by the production mutators.
  mutate: [
    'packages/proteus-js/src/**/*.ts',
    'packages/proteus-js/test/synthetic/js-shapes.ts',
  ],
  tsconfigFile: 'packages/proteus-js/tsconfig.stryker.json',
  incrementalFile: 'reports/stryker-incremental/@muirjs/proteus-js.src.json',
  ...reportFiles('@muirjs/proteus-js.src'),
  lzNodeTest: {
    testFiles: ['packages/proteus-js/test/**/*.test.ts'],
    nodeArgs: [source],
  },
});
