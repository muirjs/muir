// LzStorybookSpyStub and the lz-storybook ignorer read the same definition-time stub sites, so every SpyStub mutant
// at an erased stub is Ignored with the ignorer's reason and every SpyStub mutant at a kept stub is placed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { lzStorybookTestMutators } from '@layzee/stryker-storybook-test-mutators';

import { stubIgnorer } from '../src/stub-ignorer.ts';
import { spyStubName, spyStubReason } from '../src/stub-verdict.ts';
import { instrument } from './support/instrument.ts';

const fixtures = fileURLToPath(new URL('fixtures/', import.meta.url));

async function spyStubMutants(name: string) {
  const ignorer = stubIgnorer(
    { lzStorybook: { configDir: join(fixtures, 'no-main', '.storybook') } },
    { info: () => undefined, warn: () => undefined },
  );
  const { mutants } = await instrument(
    join(fixtures, 'no-main', 'src', `${name}.stories.tsx`),
    readFileSync(
      join(fixtures, 'reset-cases', `${name}.stories.tsx.txt`),
      'utf8',
    ),
    [ignorer],
  );

  return mutants
    .filter(({ mutatorName }) => mutatorName === spyStubName)
    .map(({ line, ignoreReason }) => ({ line, ignoreReason }));
}

/** The SpyStub and SpyStubOutcome mutants of a story whose `onSave` arg is `stub`, each as its mutator name and replacement. */
async function namedStubMutants(stub: string) {
  const { mutants } = await instrument(
    join(fixtures, 'no-main', 'src', 'Outcome.stories.tsx'),
    [
      "import { fn } from 'storybook/test';",
      '',
      "export default { title: 'Outcome' };",
      '',
      `export const Primary = { args: { onSave: ${stub} }, play: async () => {} };`,
      '',
    ].join('\n'),
    [],
  );

  return mutants
    .filter(({ mutatorName }) => mutatorName.startsWith(spyStubName))
    .map(({ mutatorName, replacement }) => [mutatorName, replacement]);
}

describe('LzStorybookSpyStub with the lz-storybook ignorer', () => {
  before(async () => {
    await lzStorybookTestMutators({
      experimental: {
        LzStorybookSpyStub: true,
        LzStorybookSpyStubOutcome: true,
      },
    });
  });

  it('reports each SpyStub mutant at a stub the reset erases as Ignored with the erased reason', async () => {
    assert.deepEqual(await spyStubMutants('F01AllDefault'), [
      { line: 14, ignoreReason: spyStubReason('erased') },
      { line: 21, ignoreReason: spyStubReason('erased') },
    ]);
  });

  it('names the removal mutant of a mockResolvedValue stub LzStorybookSpyStub, which the reporter counts, and its outcome mutant LzStorybookSpyStubOutcome, which it does not', async () => {
    assert.deepEqual(
      await namedStubMutants("fn().mockResolvedValue('saved')"),
      [
        [spyStubName, 'fn()'],
        [
          'LzStorybookSpyStubOutcome',
          'fn().mockRejectedValue(new Error("Stryker"))',
        ],
      ],
    );
  });

  it('names the removal mutant of a mockRejectedValueOnce stub LzStorybookSpyStub and its outcome mutant LzStorybookSpyStubOutcome', async () => {
    assert.deepEqual(
      await namedStubMutants("fn().mockRejectedValueOnce(new Error('no'))"),
      [
        [spyStubName, 'fn()'],
        ['LzStorybookSpyStubOutcome', 'fn().mockResolvedValueOnce(undefined)'],
      ],
    );
  });

  it('places each SpyStub mutant at a stub the reset keeps', async () => {
    assert.deepEqual(await spyStubMutants('F02MetaOff'), [
      { line: 14, ignoreReason: undefined },
      { line: 21, ignoreReason: undefined },
    ]);
  });
});
