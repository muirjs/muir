import type { NodePath } from '@babel/core';
import {
  checkNames,
  corePackageJson,
  fieldOf,
  register,
  resolveInstrumenter,
  selectMutators,
  selfCheck,
  undoOnThrow,
  warnUntested,
  type Instrumenter as CoreInstrumenter,
  type MutatorSets,
} from '@layzee/stryker-mutator-install';

import {
  babelTypeMembers,
  type BabelTypes,
  type LzMswMutator,
} from './mutator.ts';
import { packageName } from './package-name.ts';

export type Instrumenter = CoreInstrumenter<BabelTypes>;

export const testedVersion = '10.1.1';

export function resolveFromCore(
  corePackage: string = corePackageJson(),
): Promise<Instrumenter> {
  return resolveInstrumenter(packageName, assertBabelTypes, corePackage);
}

function assertBabelTypes(
  value: unknown,
  missing: (name: string) => Error,
): asserts value is BabelTypes {
  const absent = babelTypeMembers.filter(
    (member) => typeof fieldOf(value, member) !== 'function',
  );

  if (absent.length > 0) {
    throw missing(`Babel types with ${absent.join(', ')}`);
  }
}

export async function install(
  sets: MutatorSets<LzMswMutator>,
  options: unknown,
  resolve: () => Promise<Instrumenter>,
  warn: (message: string) => void = console.warn,
  info: (message: string) => void = console.info,
): Promise<void> {
  const mutators = selectMutators(packageName, 'lzMswMutators', sets, options);
  const instrumenter = await resolve();

  checkNames(packageName, mutators, instrumenter.allMutators);
  await undoOnThrow([instrumenter.allMutators], async () => {
    register(
      packageName,
      instrumenter.allMutators,
      mutators.map(({ name, mutate }) => ({
        name,
        mutate: (path: NodePath) => mutate(path, instrumenter.types),
      })),
    );
    await selfCheck(packageName, instrumenter, mutators);
  });

  warnUntested(packageName, testedVersion, instrumenter, warn);
  info(startLine(sets, mutators));
}

function startLine(
  sets: MutatorSets<LzMswMutator>,
  mutators: readonly LzMswMutator[],
): string {
  const namesOf = (listed: readonly LzMswMutator[]): string =>
    listed.map(({ name }) => name).join(', ');
  const optional = mutators.filter(
    (mutator) => !sets.defaults.includes(mutator),
  );

  const line = `${packageName}: ${mutators.length} LzMsw mutators on, beside Stryker's built-in mutators.`;

  if (mutators.length === 0) {
    return `${line} Off as experimental: ${namesOf(sets.experimental)}; lzMswMutators({ experimental: true }) turns them on.`;
  }

  return optional.length > 0
    ? `${line} Experimental: ${namesOf(optional)}.`
    : line;
}
