// Each case must give exactly the MuirProteusMsw mutants it lists, through the real instrumenter with the real install; the
// built-ins' mutants are left out. The install and the instrumentation run in a before hook, so that an error there
// fails every case instead of the file.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { before, test } from 'node:test';

import {
  muirMoiraMutatorsCoreInstrument,
  muirMoiraMutatorsFieldOf,
  type MuirMoiraMutatorsSourceFile,
} from '@muirjs/moira-mutators';

import { muirProteusMswMutators } from '../../src/index.ts';
import { muirProteusMswResolveFromCore } from '../../src/install.ts';
import { muirProteusMswMutatorSets } from '../../src/mutators.ts';
import { muirProteusMswPackageName } from '../../src/package-name.ts';
import type { Case } from '../cases.ts';

interface Mutant {
  readonly fileName: string;
  readonly mutatorName: string;
  readonly replacement: string;
}

const ours: ReadonlySet<string> = new Set(
  Object.values(muirProteusMswMutatorSets)
    .flat()
    .map(({ name }) => name),
);

async function mutantsOf(
  files: readonly MuirMoiraMutatorsSourceFile[],
): Promise<readonly Mutant[]> {
  const instrument = await muirMoiraMutatorsCoreInstrument({
    packageName: muirProteusMswPackageName,
    ...(await muirProteusMswResolveFromCore()),
  });
  const mutants = muirMoiraMutatorsFieldOf(
    await instrument(files, [], []),
    'mutants',
  );

  if (!Array.isArray(mutants)) {
    throw new Error('Instrumenter.instrument() gave no mutants');
  }

  return mutants.map((mutant: unknown) => ({
    fileName: String(muirMoiraMutatorsFieldOf(mutant, 'fileName')),
    mutatorName: String(muirMoiraMutatorsFieldOf(mutant, 'mutatorName')),
    replacement: String(muirMoiraMutatorsFieldOf(mutant, 'replacement')),
  }));
}

function fileOf(testCase: Case): string {
  return join(import.meta.dirname, '..', 'out', `${testCase.id}.ts`);
}

function normalize(code: string): string {
  return code.replace(/\s+/g, ' ').trim();
}

export function runCases(cases: readonly Case[]): void {
  let mutants: readonly Mutant[];

  before(async () => {
    await muirProteusMswMutators();
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
