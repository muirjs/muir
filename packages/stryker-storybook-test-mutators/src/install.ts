import type { NodePath } from '@babel/core';
import {
  builtInNames,
  checkBuiltInsRemoved,
  checkNames,
  register,
  removeBuiltIns,
  selectMutators,
  selfCheck,
  undoOnThrow,
  warnUntested,
  type Instrumenter as CoreInstrumenter,
  type MutatorSets,
} from '@layzee/stryker-mutator-install';

import type { BabelTypes, LzStorybookTestMutator } from './mutator.ts';
import { packageName } from './package-name.ts';

export type Instrumenter = CoreInstrumenter<BabelTypes>;

export const testedVersion = '10.1.1';

export async function install(
  sets: MutatorSets<LzStorybookTestMutator>,
  options: unknown,
  resolve: () => Promise<Instrumenter>,
  warn: (message: string) => void = console.warn,
  info: (message: string) => void = console.info,
): Promise<void> {
  const mutators = selectMutators(
    packageName,
    'lzStorybookTestMutators',
    sets,
    options,
  );
  const instrumenter = await resolve();

  checkNames(packageName, mutators, instrumenter.allMutators);
  await undoOnThrow([instrumenter.allMutators], async () => {
    removeBuiltIns(packageName, instrumenter, warn);
    register(
      packageName,
      instrumenter.allMutators,
      mutators.map(({ name, mutate }) => ({
        name,
        mutate: (path: NodePath) => mutate(path, instrumenter.types),
      })),
    );
    await selfCheck(packageName, instrumenter, mutators);
    await checkBuiltInsRemoved(packageName, instrumenter);
  });

  warnUntested(packageName, testedVersion, instrumenter, warn);
  info(startLine(sets, mutators));
}

function startLine(
  sets: MutatorSets<LzStorybookTestMutator>,
  mutators: readonly LzStorybookTestMutator[],
): string {
  const optional = mutators.filter(
    (mutator) => !sets.defaults.includes(mutator),
  );

  return (
    `${packageName}: Stryker's ${builtInNames.length} built-in mutators are off for every file in this run; ` +
    `${mutators.length} LzStorybook mutators on.` +
    (optional.length > 0
      ? ` Opt-in or experimental: ${optional.map(({ name }) => name).join(', ')}.`
      : '')
  );
}
