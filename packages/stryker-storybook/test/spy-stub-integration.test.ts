// LzStorybookSpyStub and the lz-storybook ignorer read the same definition-time stub sites, so every SpyStub mutant
// at an erased stub is Ignored with the ignorer's reason and every SpyStub mutant at a kept stub is placed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { lzStorybookTestMutators } from '@layzee/stryker-storybook-test-mutators';

import { isOutcomeMutant } from '../src/reporter.ts';
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

/** The SpyStub mutants of a story whose `onSave` arg is `stub`, each with whether the reporter takes it for an outcome mutant. */
async function classifiedStubMutants(stub: string) {
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
    .filter(({ mutatorName }) => mutatorName === spyStubName)
    .map(({ replacement }) => [replacement, isOutcomeMutant(replacement)]);
}

describe('LzStorybookSpyStub with the lz-storybook ignorer', () => {
  before(async () => {
    await lzStorybookTestMutators({
      experimental: { LzStorybookSpyStub: true },
    });
  });

  it('reports each SpyStub mutant at a stub the reset erases as Ignored with the erased reason', async () => {
    assert.deepEqual(await spyStubMutants('F01AllDefault'), [
      { line: 14, ignoreReason: spyStubReason('erased') },
      { line: 21, ignoreReason: spyStubReason('erased') },
    ]);
  });

  it("counts LzStorybookSpyStub's outcome mutant of a mockResolvedValue stub as an outcome mutant in the reporter, and its removal mutant as none", async () => {
    assert.deepEqual(
      await classifiedStubMutants("fn().mockResolvedValue('saved')"),
      [
        ['fn()', false],
        ['fn().mockRejectedValue(new Error("Stryker"))', true],
      ],
    );
  });

  it("counts LzStorybookSpyStub's outcome mutant of a mockRejectedValueOnce stub as an outcome mutant in the reporter, and its removal mutant as none", async () => {
    assert.deepEqual(
      await classifiedStubMutants(
        "fn().mockRejectedValueOnce(new Error('no'))",
      ),
      [
        ['fn()', false],
        ['fn().mockResolvedValueOnce(undefined)', true],
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
