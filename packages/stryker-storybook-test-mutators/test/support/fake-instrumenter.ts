import {
  builtInNames,
  markOf,
  selfCheckFile,
  type ListedMutator,
  type MutatorSets,
} from '@layzee/stryker-mutator-install';

import { testedVersion, type Instrumenter } from '../../src/install.ts';
import type { BabelTypes, LzStorybookTestMutator } from '../../src/mutator.ts';
import { packageName } from '../../src/package-name.ts';

export const fakeTypes: BabelTypes = {
  emptyStatement: () => ({ type: 'EmptyStatement' }),
};

export const ownMark = markOf(packageName);

export function mutator(name: string): LzStorybookTestMutator {
  return {
    name,
    sample: `export const ${name.toLowerCase()} = 1;\n`,
    mutate: () => [],
  };
}

export function sets(
  defaults: readonly string[],
  optIn: readonly string[] = [],
  experimental: readonly string[] = [],
): MutatorSets<LzStorybookTestMutator> {
  return {
    defaults: defaults.map(mutator),
    optIn: optIn.map(mutator),
    experimental: experimental.map(mutator),
  };
}

/**
 * A fake instrumenter that holds the 17 built-ins. Each marked mutator not in `silent` makes one mutant in its own
 * self-check file, and the built-ins named in `leaking` make a mutant of the built-in sample.
 */
export function fakeInstrumenter({
  silent = [],
  leaking = [],
  version = testedVersion,
}: {
  readonly silent?: readonly string[];
  readonly leaking?: readonly string[];
  readonly version?: string;
} = {}) {
  const allMutators: ListedMutator[] = builtInNames.map((name) => ({
    name,
    mutate: () => undefined,
  }));
  const instrumenter: Instrumenter = {
    dir: '/stryker/instrumenter',
    version,
    types: fakeTypes,
    allMutators,
    async instrument() {
      return [
        ...allMutators
          .filter(
            (listed) => ownMark in listed && !silent.includes(listed.name),
          )
          .map((listed) => ({
            fileName: selfCheckFile(listed.name),
            mutatorName: listed.name,
          })),
        ...leaking.map((mutatorName) => ({
          fileName: selfCheckFile('built-ins'),
          mutatorName,
        })),
      ];
    },
  };

  return {
    instrumenter,
    names: () => allMutators.map(({ name }) => name),
  };
}
