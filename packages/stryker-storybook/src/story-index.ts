import { loadCsf } from 'storybook/internal/csf-tools';

import type { IndexedStory } from './csf.ts';
import { isStringArray } from './is-record.ts';
import { field, list } from './node-field.ts';

/** The stories Storybook's CsfFile indexes; none when Storybook cannot read the file. */
export function storyIndex(
  code: string,
  fileName: string,
): ReadonlyMap<string, IndexedStory> {
  const inputs = list(indexInputs(code, fileName));

  return new Map(
    inputs.flatMap((input) => {
      const exportName = field(input, 'exportName');
      const tags = field(input, 'tags');

      return field(input, 'subtype') === 'story' &&
        typeof exportName === 'string' &&
        isStringArray(tags)
        ? [
            [
              exportName,
              {
                tags,
                tests: inputs
                  .filter(
                    (test) =>
                      field(test, 'subtype') === 'test' &&
                      field(test, 'exportName') === exportName,
                  )
                  .map((test) => field(test, 'name')),
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
