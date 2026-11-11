// Each case must give exactly the mutants it lists, through the real instrumenter with the real install. The install
// and the instrumentation run in a before hook, so that an error there fails every case instead of the file.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { before, test } from 'node:test';

import {
  coreInstrument,
  fieldOf,
  type SourceFile,
} from '@layzee/stryker-mutator-install';

import { lzStorybookTestMutators } from '../../src/index.ts';
import { resolveFromCore } from '../../src/install.ts';
import { packageName } from '../../src/package-name.ts';
import type { Case } from '../cases.ts';

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

function fileOf(testCase: Case): string {
  return join(import.meta.dirname, '..', 'out', `${testCase.id}.stories.ts`);
}

function normalize(code: string): string {
  return code.replace(/\s+/g, ' ').trim();
}

export function runCases(cases: readonly Case[]): void {
  let mutants: readonly Mutant[];

  before(async () => {
    await lzStorybookTestMutators();
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
        .filter(({ fileName }) => fileName === fileOf(testCase))
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
