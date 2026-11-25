import { fileURLToPath } from 'node:url';

import { muirShadowcatStorybookCsfIgnorer } from '../../src/csf-ignorer.ts';
import { instrument } from './instrument.ts';

const configDir = fileURLToPath(
  new URL(
    '../../../moira-storybook/test/fixtures/no-main/.storybook',
    import.meta.url,
  ),
);
export const staticReason =
  'muir-shadowcat-storybook-csf: Storybook reads this CSF value without running the file, so it stays as written';
export const metaReason =
  'muir-shadowcat-storybook-csf: Storybook reads the meta object without running the file, so it stays an object literal';
export const containerReason =
  'muir-shadowcat-storybook-csf: Storybook reads this story, its parameters or its test options without running the file, so it stays an object or a function';
export const testReason =
  'muir-shadowcat-storybook-csf: test code in a story file is mutated by the Stryker config with muirShadowcatStorybookCsf.play set to mutate';
export const mswReason =
  'muir-shadowcat-storybook-csf: msw handlers in a story file are mutated by the Stryker config with muirShadowcatStorybookCsf.play set to mutate';

export function setup(play?: 'ignore' | 'mutate') {
  const ignorer = muirShadowcatStorybookCsfIgnorer(
    {
      muirShadowcatStorybook: { configDir },
      muirShadowcatStorybookCsf: play ? { play } : {},
    },
    { info: () => undefined, warn: () => undefined },
  );

  return {
    outcomes: async (code: string, fileName = 'src/a.stories.tsx') =>
      (await instrument(fileName, code, [ignorer])).mutants.map(
        ({ mutatorName, line, ignoreReason }) =>
          `${line} ${mutatorName} ${ignoreReason ?? 'placed'}`,
      ),
    warnings: async (code: string) =>
      (await instrument('src/a.stories.tsx', code, [ignorer])).warnings,
  };
}
