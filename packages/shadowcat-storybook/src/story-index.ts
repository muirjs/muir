import {
  muirMoiraStorybookField,
  muirMoiraStorybookIsStringArray,
  muirMoiraStorybookList,
  type MuirMoiraStorybookIndexedStory,
} from '@muirjs/moira-storybook';
import { loadCsf } from 'storybook/internal/csf-tools';

/** The stories Storybook's CsfFile indexes; none when Storybook cannot read the file. */
export function muirShadowcatStorybookStoryIndex(
  code: string,
  fileName: string,
): ReadonlyMap<string, MuirMoiraStorybookIndexedStory> {
  const inputs = muirMoiraStorybookList(indexInputs(code, fileName));

  return new Map(
    inputs.flatMap((input) => {
      const exportName = muirMoiraStorybookField(input, 'exportName');
      const tags = muirMoiraStorybookField(input, 'tags');

      return muirMoiraStorybookField(input, 'subtype') === 'story' &&
        typeof exportName === 'string' &&
        muirMoiraStorybookIsStringArray(tags)
        ? [
            [
              exportName,
              {
                tags,
                tests: inputs
                  .filter(
                    (test) =>
                      muirMoiraStorybookField(test, 'subtype') === 'test' &&
                      muirMoiraStorybookField(test, 'exportName') ===
                        exportName,
                  )
                  .map((test) => muirMoiraStorybookField(test, 'name')),
              },
            ] as const,
          ]
        : [];
    }),
  );
}

function indexInputs(code: string, fileName: string): unknown {
  try {
    return loadCsf(code, {
      fileName,
      makeTitle: (title: string | undefined) => title ?? fileName,
    }).parse().indexInputs;
  } catch {
    return undefined;
  }
}
