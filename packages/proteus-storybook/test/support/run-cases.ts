// Each case must give exactly the MuirProteusStorybook mutants it lists, through the real instrumenter with the real install;
// the built-ins' mutants are left out. The install and the instrumentation run in a before hook, so that an error
// there fails every case instead of the file.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { before, test } from 'node:test';

import {
  muirMoiraMutatorsCoreInstrument,
  muirMoiraMutatorsFieldOf,
  type MuirMoiraMutatorsSourceFile,
} from '@muirjs/moira-mutators';

import { muirProteusStorybookMutators } from '../../src/index.ts';
import { muirProteusStorybookResolveFromCore } from '../../src/install.ts';
import { muirProteusStorybookMutatorSets } from '../../src/mutators.ts';
import { muirProteusStorybookPackageName } from '../../src/package-name.ts';
import type { Case } from './case.ts';

interface Mutant {
  readonly fileName: string;
  readonly mutatorName: string;
  readonly replacement: string;
}

const ours: ReadonlySet<string> = new Set(
  Object.values(muirProteusStorybookMutatorSets)
    .flat()
    .map(({ name }) => name),
);

async function mutantsOf(
  files: readonly MuirMoiraMutatorsSourceFile[],
): Promise<readonly Mutant[]> {
  const instrument = await muirMoiraMutatorsCoreInstrument({
    packageName: muirProteusStorybookPackageName,
    ...(await muirProteusStorybookResolveFromCore()),
  });
  const mutants = muirMoiraMutatorsFieldOf(
    await instrument(files, [], []),
    'mutants',
  );

  if (!Array.isArray(mutants)) {
    throw new Error('Instrumenter.instrument() gave no mutants');
  }

  return mutants.map((mutant: unknown) => ({
    fileName: stringField(mutant, 'fileName'),
    mutatorName: stringField(mutant, 'mutatorName'),
    replacement: stringField(mutant, 'replacement'),
  }));
}

function stringField(mutant: unknown, key: string): string {
  const value = muirMoiraMutatorsFieldOf(mutant, key);

  if (typeof value !== 'string') {
    throw new TypeError(
      `Instrumenter.instrument() gave a mutant with no ${key}`,
    );
  }

  return value;
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
    await muirProteusStorybookMutators({
      experimental: { MuirProteusStorybookArgs: true },
    });
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
          ({ fileName, mutatorName }) =>
            fileName === fileOf(testCase) && ours.has(mutatorName),
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
