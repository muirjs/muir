import { packageConfig } from '../../stryker.package.ts';

export default {
  ...packageConfig(
    'storybook-csf',
    ['*.test.ts'],
    ['packages/stryker-storybook/test/*.test.ts'],
  ),
  // stryker-storybook's tests import this package through node_modules, which a sandbox links to the unmutated sources.
  inPlace: true,
};
