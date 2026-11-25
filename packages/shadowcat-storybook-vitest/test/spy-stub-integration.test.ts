// MuirProteusStorybookTestSpyStub and the muir-shadowcat-storybook-vitest ignorer read the same definition-time stubs, so every SpyStub mutant
// at an erased stub is Ignored with the ignorer's reason and every SpyStub mutant at a kept stub is placed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  muirMoiraStorybookSpyStubName,
  muirMoiraStorybookSpyStubReason,
} from '@muirjs/moira-storybook';
import { muirProteusStorybookTestMutators } from '@muirjs/proteus-storybook-test';

import {
  muirShadowcatStorybookVitestPluginName,
  muirShadowcatStorybookVitestStubIgnorer,
} from '../src/stub-ignorer.ts';
import { instrument } from './support/instrument.ts';

// The Storybook projects of @muirjs/moira-storybook's tests; the test and mutate-src targets list them as inputs.
const fixtures = fileURLToPath(
  new URL('../../moira-storybook/test/fixtures/', import.meta.url),
);

async function spyStubMutants(name: string) {
  const ignorer = muirShadowcatStorybookVitestStubIgnorer(
    {
      muirShadowcatStorybook: {
        configDir: join(fixtures, 'no-main', '.storybook'),
      },
    },
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
    .filter(({ mutatorName }) => mutatorName === muirMoiraStorybookSpyStubName)
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
    .filter(({ mutatorName }) =>
      mutatorName.startsWith(muirMoiraStorybookSpyStubName),
    )
    .map(({ mutatorName, replacement }) => [mutatorName, replacement]);
}

describe('MuirProteusStorybookTestSpyStub with the muir-shadowcat-storybook-vitest ignorer', () => {
  before(async () => {
    await muirProteusStorybookTestMutators({
      experimental: {
        MuirProteusStorybookTestSpyStub: true,
        MuirProteusStorybookTestSpyStubOutcome: true,
      },
    });
  });

  it('reports each SpyStub mutant at a stub the reset erases as Ignored with the erased reason', async () => {
    assert.deepEqual(await spyStubMutants('F01AllDefault'), [
      {
        line: 14,
        ignoreReason: muirMoiraStorybookSpyStubReason(
          'erased',
          muirShadowcatStorybookVitestPluginName,
        ),
      },
      {
        line: 21,
        ignoreReason: muirMoiraStorybookSpyStubReason(
          'erased',
          muirShadowcatStorybookVitestPluginName,
        ),
      },
    ]);
  });

  it('names the removal mutant of a mockResolvedValue stub MuirProteusStorybookTestSpyStub, which the reporter counts, and its outcome mutant MuirProteusStorybookTestSpyStubOutcome, which it does not', async () => {
    assert.deepEqual(
      await namedStubMutants("fn().mockResolvedValue('saved')"),
      [
        [muirMoiraStorybookSpyStubName, 'fn()'],
        [
          'MuirProteusStorybookTestSpyStubOutcome',
          'fn().mockRejectedValue(new Error("Stryker"))',
        ],
      ],
    );
  });

  it('names the removal mutant of a mockRejectedValueOnce stub MuirProteusStorybookTestSpyStub and its outcome mutant MuirProteusStorybookTestSpyStubOutcome', async () => {
    assert.deepEqual(
      await namedStubMutants("fn().mockRejectedValueOnce(new Error('no'))"),
      [
        [muirMoiraStorybookSpyStubName, 'fn()'],
        [
          'MuirProteusStorybookTestSpyStubOutcome',
          'fn().mockResolvedValueOnce(undefined)',
        ],
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
