import { types } from '@babel/core';
import {
  markOf,
  selfCheckFile,
  type ListedMutator,
  type MutatorSets,
} from '@muirjs/moira-mutators';

import { testedVersion, type Instrumenter } from '../../src/install.ts';
import type { LzMswMutator } from '../../src/mutator.ts';
import { packageName } from '../../src/package-name.ts';

export const ownMark = markOf(packageName);

export const builtIns: readonly string[] = ['ObjectLiteral', 'StringLiteral'];

export function mutator(name: string): LzMswMutator {
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
): MutatorSets<LzMswMutator> {
  return {
    defaults: defaults.map(mutator),
    optIn: optIn.map(mutator),
    experimental: experimental.map(mutator),
  };
}

/** A fake instrumenter that holds two built-ins. Each marked mutator not in `silent` makes one mutant in its own self-check file. */
export function fakeInstrumenter({
  silent = [],
  version = testedVersion,
}: {
  readonly silent?: readonly string[];
  readonly version?: string;
} = {}) {
  const allMutators: ListedMutator[] = builtIns.map((name) => ({
    name,
    mutate: () => undefined,
  }));
  const instrumenter: Instrumenter = {
    dir: '/stryker/instrumenter',
    version,
    types,
    allMutators,
    async instrument() {
      return allMutators
        .filter((listed) => ownMark in listed && !silent.includes(listed.name))
        .map((listed) => ({
          fileName: selfCheckFile(listed.name),
          mutatorName: listed.name,
        }));
    },
  };

  return {
    instrumenter,
    names: () => allMutators.map(({ name }) => name),
  };
}
