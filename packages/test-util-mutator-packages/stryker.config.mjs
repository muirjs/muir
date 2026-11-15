import { packageConfig } from '../../stryker.package.ts';

export default {
  ...packageConfig('test-util-mutator-packages'),
  // compose-skips.ts is the harness that checks the equivalence proofs against Storybook; it is left out until its own run.
  mutate: [
    'packages/test-util-mutator-packages/src/readme-tiers.ts',
    'packages/test-util-mutator-packages/src/temp-tree.ts',
  ],
};
