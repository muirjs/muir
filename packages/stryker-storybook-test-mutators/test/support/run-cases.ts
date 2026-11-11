// Each case must give exactly the mutants it lists of one mutator and of every mutator outside this package (so a
// built-in that is not removed shows up), through the real instrumenter with the real install and the given options.
// The install and the instrumentation run in a before hook, so that an error there fails every case instead of the
// file.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { before, test } from 'node:test';

import {
  coreInstrument,
  fieldOf,
  type SourceFile,
} from '@layzee/stryker-mutator-install';

import {
  lzStorybookTestMutators,
  type LzStorybookTestMutatorOptions,
} from '../../src/index.ts';
import { resolveFromCore } from '../../src/install.ts';
import { mutatorSets } from '../../src/mutators.ts';
import { packageName } from '../../src/package-name.ts';
import type { Case } from './case.ts';

interface Mutant {
  readonly fileName: string;
  readonly mutatorName: string;
  readonly replacement: string;
}

async function mutantsOf(
  files: readonly SourceFile[],
): Promise<readonly Mutant[]> {
  const instrument = await coreInstrument({
    packageName,
    ...(await resolveFromCore()),
  });
  const mutants = fieldOf(await instrument(files), 'mutants');

  if (!Array.isArray(mutants)) {
    throw new Error('Instrumenter.instrument() gave no mutants');
  }

  return mutants.map((mutant: unknown) => ({
    fileName: String(fieldOf(mutant, 'fileName')),
    mutatorName: String(fieldOf(mutant, 'mutatorName')),
    replacement: String(fieldOf(mutant, 'replacement')),
  }));
}

const lzNames: ReadonlySet<string> = new Set(
  Object.values(mutatorSets)
    .flat()
    .map(({ name }) => name),
);

function fileOf(testCase: Case): string {
  return join(import.meta.dirname, '..', 'out', `${testCase.id}.stories.ts`);
}

function normalize(code: string): string {
  return code.replace(/\s+/g, ' ').trim();
}

export function runCases(
  mutatorName: string,
  cases: readonly Case[],
  options?: LzStorybookTestMutatorOptions,
): void {
  let mutants: readonly Mutant[];

  before(async () => {
    await lzStorybookTestMutators(options);
    mutants = await mutantsOf(
      cases.map((testCase) => ({
        name: fileOf(testCase),
        content: testCase.source,
      })),
    );
  });

  cases.forEach((testCase) => {
    test(`${testCase.id}: ${testCase.title}`, () => {
      const actual = mutants
        .filter(
          (mutant) =>
            mutant.fileName === fileOf(testCase) &&
            (mutant.mutatorName === mutatorName ||
              !lzNames.has(mutant.mutatorName)),
        )
        .map(
          ({ mutatorName, replacement }) =>
            `${mutatorName} ${normalize(replacement)}`,
        )
        .sort();
      const expected = testCase.expect
        .map(([mutator, replacement]) => `${mutator} ${normalize(replacement)}`)
        .sort();

      assert.deepEqual(actual, expected);
    });
  });
}
