import type { NodePath } from '@babel/core';
import {
  muirMoiraMutatorsCheckNames,
  muirMoiraMutatorsCorePackageJson,
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsRegister,
  muirMoiraMutatorsResolveInstrumenter,
  muirMoiraMutatorsSelectMutators,
  muirMoiraMutatorsSelfCheck,
  muirMoiraMutatorsUndoOnThrow,
  muirMoiraMutatorsWarnUntested,
  type MuirMoiraMutatorsInstrumenter as CoreInstrumenter,
  type MuirMoiraMutatorsMutatorSets,
} from '@muirjs/moira-mutators';

import {
  muirProteusMswBabelTypeMembers,
  type MuirProteusMswBabelTypes,
  type MuirProteusMswMutator,
} from './mutator.ts';
import { muirProteusMswPackageName } from './package-name.ts';

export type MuirProteusMswInstrumenter =
  CoreInstrumenter<MuirProteusMswBabelTypes>;

export const muirProteusMswTestedVersion = '10.1.1';

export function muirProteusMswResolveFromCore(
  corePackage: string = muirMoiraMutatorsCorePackageJson(),
): Promise<MuirProteusMswInstrumenter> {
  return muirMoiraMutatorsResolveInstrumenter(
    muirProteusMswPackageName,
    assertBabelTypes,
    corePackage,
  );
}

function assertBabelTypes(
  value: unknown,
  missing: (name: string) => Error,
): asserts value is MuirProteusMswBabelTypes {
  const absent = muirProteusMswBabelTypeMembers.filter(
    (member) => typeof muirMoiraMutatorsFieldOf(value, member) !== 'function',
  );

  if (absent.length > 0) {
    throw missing(`Babel types with ${absent.join(', ')}`);
  }
}

export async function muirProteusMswInstall(
  sets: MuirMoiraMutatorsMutatorSets<MuirProteusMswMutator>,
  options: unknown,
  resolve: () => Promise<MuirProteusMswInstrumenter>,
  warn: (message: string) => void = console.warn,
  info: (message: string) => void = console.info,
): Promise<void> {
  const mutators = muirMoiraMutatorsSelectMutators(
    muirProteusMswPackageName,
    'muirProteusMswMutators',
    sets,
    options,
  );
  const instrumenter = await resolve();

  muirMoiraMutatorsCheckNames(
    muirProteusMswPackageName,
    mutators,
    instrumenter.allMutators,
  );
  await muirMoiraMutatorsUndoOnThrow([instrumenter.allMutators], async () => {
    muirMoiraMutatorsRegister(
      muirProteusMswPackageName,
      instrumenter.allMutators,
      mutators.map(({ name, mutate }) => ({
        name,
        mutate: (path: NodePath) => mutate(path, instrumenter.types),
      })),
    );
    await muirMoiraMutatorsSelfCheck(
      muirProteusMswPackageName,
      instrumenter,
      mutators,
    );
  });

  muirMoiraMutatorsWarnUntested(
    muirProteusMswPackageName,
    muirProteusMswTestedVersion,
    instrumenter,
    warn,
  );
  info(startLine(sets, mutators));
}

function startLine(
  sets: MuirMoiraMutatorsMutatorSets<MuirProteusMswMutator>,
  mutators: readonly MuirProteusMswMutator[],
): string {
  const namesOf = (listed: readonly MuirProteusMswMutator[]): string =>
    listed.map(({ name }) => name).join(', ');
  const optional = mutators.filter(
    (mutator) => !sets.defaults.includes(mutator),
  );

  const line = `${muirProteusMswPackageName}: ${mutators.length} MuirProteusMsw mutators on, beside Stryker's built-in mutators.`;

  if (mutators.length === 0) {
    return `${line} Off as experimental: ${namesOf(sets.experimental)}; muirProteusMswMutators({ experimental: true }) turns them on.`;
  }

  return optional.length > 0
    ? `${line} Experimental: ${namesOf(optional)}.`
    : line;
}
