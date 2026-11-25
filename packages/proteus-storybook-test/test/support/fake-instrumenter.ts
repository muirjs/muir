import { types } from '@babel/core';
import {
  muirMoiraMutatorsBuiltInNames,
  muirMoiraMutatorsMarkOf,
  muirMoiraMutatorsSelfCheckFile,
  type MuirMoiraMutatorsListedMutator,
  type MuirMoiraMutatorsMutatorSets,
} from '@muirjs/moira-mutators';

import {
  muirProteusStorybookTestTestedVersion,
  type MuirProteusStorybookTestInstrumenter,
} from '../../src/install.ts';
import type { MuirProteusStorybookTestMutator } from '../../src/mutator.ts';
import { muirProteusStorybookTestPackageName } from '../../src/package-name.ts';

export const ownMark = muirMoiraMutatorsMarkOf(
  muirProteusStorybookTestPackageName,
);

export function mutator(name: string): MuirProteusStorybookTestMutator {
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
): MuirMoiraMutatorsMutatorSets<MuirProteusStorybookTestMutator> {
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
  version = muirProteusStorybookTestTestedVersion,
}: {
  readonly silent?: readonly string[];
  readonly leaking?: readonly string[];
  readonly version?: string;
} = {}) {
  const allMutators: MuirMoiraMutatorsListedMutator[] =
    muirMoiraMutatorsBuiltInNames.map((name) => ({
      name,
      mutate: () => undefined,
    }));
  const instrumenter: MuirProteusStorybookTestInstrumenter = {
    dir: '/stryker/instrumenter',
    version,
    types,
    allMutators,
    async instrument() {
      return [
        ...allMutators
          .filter(
            (listed) => ownMark in listed && !silent.includes(listed.name),
          )
          .map((listed) => ({
            fileName: muirMoiraMutatorsSelfCheckFile(listed.name),
            mutatorName: listed.name,
          })),
        ...leaking.map((mutatorName) => ({
          fileName: muirMoiraMutatorsSelfCheckFile('built-ins'),
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
