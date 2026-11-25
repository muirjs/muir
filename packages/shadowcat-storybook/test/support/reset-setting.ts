import { muirShadowcatStorybookParseProgram } from '../../src/parse.ts';
import {
  muirShadowcatStorybookClassifyStubs,
  type MuirShadowcatStorybookStoryFile,
  type MuirShadowcatStorybookStubVerdict,
} from '../../src/reset-setting.ts';
import { untaggedPreviewTestTags } from './test-tags.ts';

export function storyFile(
  code: string,
  fileName: string,
): MuirShadowcatStorybookStoryFile {
  return {
    program: muirShadowcatStorybookParseProgram(code, fileName),
    code,
    fileName,
  };
}

export function verdictsOf(
  source: string,
  testTags = untaggedPreviewTestTags,
): readonly MuirShadowcatStorybookStubVerdict[] {
  return muirShadowcatStorybookClassifyStubs(
    storyFile(
      `import { fn } from 'storybook/test';\n${source}`,
      'X.stories.ts',
    ),
    {},
    testTags,
  ).stubs.map(({ verdict }) => verdict);
}
