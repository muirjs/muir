import { packageConfig } from '../../stryker.package.ts';

export default {
  ...packageConfig(
    'moira-storybook',
    ['*.test.ts'],
    [
      'packages/shadowcat-storybook/test/*.test.ts',
      'packages/proteus-storybook/test/*.test.ts',
      'packages/proteus-storybook-test/test/*.test.ts',
    ],
  ),
  // The other packages' tests import this package through node_modules, which a sandbox links to the unmutated sources.
  inPlace: true,
};
