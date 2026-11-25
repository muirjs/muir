import { types } from '@babel/core';
import {
  muirMoiraMutatorsMarkOf,
  muirMoiraMutatorsSelfCheckFile,
  type MuirMoiraMutatorsListedMutator,
  type MuirMoiraMutatorsMutatorSets,
} from '@muirjs/moira-mutators';

import {
  muirProteusStorybookTestedVersion,
  type MuirProteusStorybookInstrumenter,
} from '../../src/install.ts';
import type { MuirProteusStorybookMutator } from '../../src/mutator.ts';
import { muirProteusStorybookPackageName } from '../../src/package-name.ts';

export const ownMark = muirMoiraMutatorsMarkOf(muirProteusStorybookPackageName);

export const builtIns: readonly string[] = ['ObjectLiteral', 'StringLiteral'];

export function mutator(name: string): MuirProteusStorybookMutator {
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
): MuirMoiraMutatorsMutatorSets<MuirProteusStorybookMutator> {
  return {
    defaults: defaults.map(mutator),
    optIn: optIn.map(mutator),
    experimental: experimental.map(mutator),
  };
}

/** A fake instrumenter that holds two built-ins. Each marked mutator not in `silent` makes one mutant in its own self-check file. */
export function fakeInstrumenter({
  silent = [],
  version = muirProteusStorybookTestedVersion,
}: {
  readonly silent?: readonly string[];
  readonly version?: string;
} = {}) {
  const allMutators: MuirMoiraMutatorsListedMutator[] = builtIns.map(
    (name) => ({
      name,
      mutate: () => undefined,
    }),
  );
  const instrumenter: MuirProteusStorybookInstrumenter = {
    dir: '/stryker/instrumenter',
    version,
    types,
    allMutators,
    async instrument() {
      return allMutators
        .filter((listed) => ownMark in listed && !silent.includes(listed.name))
        .map((listed) => ({
          fileName: muirMoiraMutatorsSelfCheckFile(listed.name),
          mutatorName: listed.name,
          replacement: '',
          location: {
            start: { line: 0, column: 0 },
            end: { line: 0, column: 1 },
          },
        }));
    },
  };

  return {
    instrumenter,
    names: () => allMutators.map(({ name }) => name),
  };
}
