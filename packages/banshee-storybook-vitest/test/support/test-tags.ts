import {
  muirMoiraStorybookDefaultTestTags,
  type MuirMoiraStorybookTestTags,
} from '@muirjs/moira-storybook';

/** The default tag filter in a project whose preview declares no tags. */
export const untaggedPreviewTestTags: MuirMoiraStorybookTestTags = {
  ...muirMoiraStorybookDefaultTestTags,
  previewTags: [],
};
