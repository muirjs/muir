import { muirMoiraStorybookParseProgram } from '../../src/parse.ts';
import {
  muirMoiraStorybookClassifyStubs,
  type MuirMoiraStorybookStoryFile,
  type MuirMoiraStorybookStubVerdict,
} from '../../src/reset-setting.ts';
import { untaggedPreviewTestTags } from './test-tags.ts';

export function storyFile(
  code: string,
  fileName: string,
): MuirMoiraStorybookStoryFile {
  return {
    program: muirMoiraStorybookParseProgram(code, fileName),
    code,
    fileName,
  };
}

export function verdictsOf(
  source: string,
  testTags = untaggedPreviewTestTags,
): readonly MuirMoiraStorybookStubVerdict[] {
  return muirMoiraStorybookClassifyStubs(
    storyFile(
      `import { fn } from 'storybook/test';\n${source}`,
      'X.stories.ts',
    ),
    {},
    testTags,
  ).stubs.map(({ verdict }) => verdict);
}
