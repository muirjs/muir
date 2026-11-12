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

function mutantLine(mutatorName: string, replacement: string): string {
  return `${mutatorName} ${replacement.replace(/\s+/g, ' ').trim()}`;
}

/** Each file's mutants of `mutatorName` and of every mutator outside this package, as sorted `<mutator> <replacement>` lines. */
export async function mutantLinesByFile(
  files: readonly SourceFile[],
  mutatorName: string,
): Promise<ReadonlyMap<string, readonly string[]>> {
  const mutants = await mutantsOf(files);

  return new Map(
    files.map(({ name }) => [
      name,
      mutants
        .filter(
          (mutant) =>
            mutant.fileName === name &&
            (mutant.mutatorName === mutatorName ||
              !lzNames.has(mutant.mutatorName)),
        )
        .map((mutant) => mutantLine(mutant.mutatorName, mutant.replacement))
        .sort(),
    ]),
  );
}

export function runCases(
  mutatorName: string,
  cases: readonly Case[],
  options?: LzStorybookTestMutatorOptions,
): void {
  let lines: ReadonlyMap<string, readonly string[]>;

  before(async () => {
    await lzStorybookTestMutators(options);
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
