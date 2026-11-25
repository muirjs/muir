import {
  muirMoiraStorybookDefaultTestTags,
  type MuirMoiraStorybookTestTags,
} from '../../src/reset-setting.ts';

/** The default tag filter in a project whose preview declares no tags. */
export const untaggedPreviewTestTags: MuirMoiraStorybookTestTags = {
  ...muirMoiraStorybookDefaultTestTags,
  previewTags: [],
};

export function testTags(
  rule: Partial<MuirMoiraStorybookTestTags>,
): MuirMoiraStorybookTestTags {
  return { ...untaggedPreviewTestTags, ...rule };
}
