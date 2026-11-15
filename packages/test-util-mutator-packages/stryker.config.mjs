import { packageConfig } from '../../stryker.package.ts';

export default {
  ...packageConfig(
    'test-util-mutator-packages',
    [],
    [
      'packages/stryker-msw-mutators/test/readme.test.ts',
      'packages/stryker-playwright-mutators/test/readme.test.ts',
      'packages/stryker-storybook-mutators/test/readme.test.ts',
      'packages/stryker-storybook-test-mutators/test/readme.test.ts',
      'packages/stryker-msw-mutators/test/install.test.ts',
      'packages/stryker-mutator-install/test/instrumenter.test.ts',
    ],
  ),
  // compose-skips.ts is the harness that checks the equivalence proofs against Storybook; it is left out until its own run.
  mutate: [
    'packages/test-util-mutator-packages/src/readme-tiers.ts',
    'packages/test-util-mutator-packages/src/temp-tree.ts',
  ],
  // The other packages' tests import this package through node_modules, which a sandbox links to the unmutated sources.
  inPlace: true,
};
