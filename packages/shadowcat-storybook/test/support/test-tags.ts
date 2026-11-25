import {
  muirShadowcatStorybookDefaultTestTags,
  type MuirShadowcatStorybookTestTags,
} from '../../src/reset-setting.ts';

/** The default tag filter in a project whose preview declares no tags. */
export const untaggedPreviewTestTags: MuirShadowcatStorybookTestTags = {
  ...muirShadowcatStorybookDefaultTestTags,
  previewTags: [],
};

export function testTags(
  rule: Partial<MuirShadowcatStorybookTestTags>,
): MuirShadowcatStorybookTestTags {
  return { ...untaggedPreviewTestTags, ...rule };
}
