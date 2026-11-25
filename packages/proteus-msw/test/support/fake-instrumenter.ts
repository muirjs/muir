import { types } from '@babel/core';
import {
  muirMoiraMutatorsMarkOf,
  muirMoiraMutatorsSelfCheckFile,
  type MuirMoiraMutatorsListedMutator,
  type MuirMoiraMutatorsMutatorSets,
} from '@muirjs/moira-mutators';

import {
  muirProteusMswTestedVersion,
  type MuirProteusMswInstrumenter,
} from '../../src/install.ts';
import type { MuirProteusMswMutator } from '../../src/mutator.ts';
import { muirProteusMswPackageName } from '../../src/package-name.ts';

export const ownMark = muirMoiraMutatorsMarkOf(muirProteusMswPackageName);

export const builtIns: readonly string[] = ['ObjectLiteral', 'StringLiteral'];

export function mutator(name: string): MuirProteusMswMutator {
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
): MuirMoiraMutatorsMutatorSets<MuirProteusMswMutator> {
  return {
    defaults: defaults.map(mutator),
    optIn: optIn.map(mutator),
    experimental: experimental.map(mutator),
  };
}

/** A fake instrumenter that holds two built-ins. Each marked mutator not in `silent` makes one mutant in its own self-check file. */
export function fakeInstrumenter({
  silent = [],
  version = muirProteusMswTestedVersion,
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
  const instrumenter: MuirProteusMswInstrumenter = {
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
        }));
    },
  };

  return {
    instrumenter,
    names: () => allMutators.map(({ name }) => name),
  };
}
