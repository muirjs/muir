import type { MuirMoiraStorybookProject } from '@muirjs/moira-storybook';

import { untaggedPreviewTestTags } from './test-tags.ts';

/** A project with the fallback story files and a preview that sets no parameters.test. */
export function project(
  transformer: MuirMoiraStorybookProject['transformer'],
  testTags = untaggedPreviewTestTags,
) {
  return {
    configDir: '.storybook',
    storyFiles: 'fallback',
    transformer,
    previewTest: {},
    testTags,
  } satisfies MuirMoiraStorybookProject;
}
