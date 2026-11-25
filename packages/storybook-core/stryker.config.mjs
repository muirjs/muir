import { packageConfig } from '../../stryker.package.ts';

export default {
  ...packageConfig(
    'storybook-core',
    ['*.test.ts'],
    [
      'packages/stryker-storybook/test/*.test.ts',
      'packages/stryker-storybook-mutators/test/*.test.ts',
      'packages/stryker-storybook-test-mutators/test/*.test.ts',
    ],
  ),
  // The other packages' tests import this package through node_modules, which a sandbox links to the unmutated sources.
  inPlace: true,
};
