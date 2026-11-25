// Each case must give exactly the mutants it lists of one mutator and of every mutator outside this package (so a
// built-in that is not removed shows up), through the real instrumenter with the real install and the given options.
// The install and the instrumentation run in a before hook, so that an error there fails every case instead of the
// file.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { before, test } from 'node:test';

import {
  muirMoiraMutatorsCoreInstrument,
  muirMoiraMutatorsFieldOf,
  type MuirMoiraMutatorsSourceFile,
} from '@muirjs/moira-mutators';

import {
  muirProteusStorybookTestMutators,
  type MuirProteusStorybookTestMutatorOptions,
} from '../../src/index.ts';
import { muirProteusStorybookTestResolveFromCore } from '../../src/install.ts';
import { muirProteusStorybookTestMutatorSets } from '../../src/mutators.ts';
import { muirProteusStorybookTestPackageName } from '../../src/package-name.ts';
import type { Case } from './case.ts';

interface Mutant {
  readonly fileName: string;
  readonly mutatorName: string;
  readonly replacement: string;
}

async function mutantsOf(
  files: readonly MuirMoiraMutatorsSourceFile[],
): Promise<readonly Mutant[]> {
  const instrument = await muirMoiraMutatorsCoreInstrument({
    packageName: muirProteusStorybookTestPackageName,
    ...(await muirProteusStorybookTestResolveFromCore()),
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
  return join(import.meta.dirname, '..', 'out', `${testCase.id}.stories.ts`);
}

function mutantLine(mutatorName: string, replacement: string): string {
  return `${mutatorName} ${replacement.replace(/\s+/g, ' ').trim()}`;
}

/** Each file's mutants of `mutatorName` and of every mutator outside this package, as sorted `<mutator> <replacement>` lines. */
export async function mutantLinesByFile(
  files: readonly MuirMoiraMutatorsSourceFile[],
  mutatorName: string,
): Promise<ReadonlyMap<string, readonly string[]>> {
  const mutants = await mutantsOf(files);
  const ownNames: ReadonlySet<string> = new Set(
    Object.values(muirProteusStorybookTestMutatorSets)
      .flat()
      .map(({ name }) => name),
  );

  return new Map(
    files.map(({ name }) => [
      name,
      mutants
        .filter(
          (mutant) =>
            mutant.fileName === name &&
            (mutant.mutatorName === mutatorName ||
              !ownNames.has(mutant.mutatorName)),
        )
        .map((mutant) => mutantLine(mutant.mutatorName, mutant.replacement))
        .sort(),
    ]),
  );
}

export function runCases(
  mutatorName: string,
  cases: readonly Case[],
  options?: MuirProteusStorybookTestMutatorOptions,
): void {
  let lines: ReadonlyMap<string, readonly string[]>;

  before(async () => {
    await muirProteusStorybookTestMutators(options);
    lines = await mutantLinesByFile(
      cases.map((testCase) => ({
        name: fileOf(testCase),
        content: testCase.source,
      })),
      mutatorName,
    );
  });

  cases.forEach((testCase) => {
    test(`${testCase.id}: ${testCase.title}`, () => {
      const expected = testCase.expect
        .map(([mutator, replacement]) => mutantLine(mutator, replacement))
        .sort();

      assert.deepEqual(lines.get(fileOf(testCase)), expected);
    });
  });
}
