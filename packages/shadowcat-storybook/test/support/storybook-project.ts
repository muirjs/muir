import type { MuirShadowcatStorybookProject } from '../../src/storybook-project.ts';
import { untaggedPreviewTestTags } from './test-tags.ts';

/** A project with the fallback story files and a preview that sets no parameters.test. */
export function project(
  transformer: MuirShadowcatStorybookProject['transformer'],
  testTags = untaggedPreviewTestTags,
) {
  return {
    configDir: '.storybook',
    storyFiles: 'fallback',
    transformer,
    previewTest: {},
    testTags,
  } satisfies MuirShadowcatStorybookProject;
}
