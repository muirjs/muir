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
  muirProteusStorybookBabelTypeMembers,
  type MuirProteusStorybookBabelTypes,
  type MuirProteusStorybookMutator,
} from './mutator.ts';
import { muirProteusStorybookPackageName } from './package-name.ts';

export type MuirProteusStorybookInstrumenter =
  CoreInstrumenter<MuirProteusStorybookBabelTypes>;

export const muirProteusStorybookTestedVersion = '10.1.1';

export function muirProteusStorybookResolveFromCore(
  corePackage: string = muirMoiraMutatorsCorePackageJson(),
): Promise<MuirProteusStorybookInstrumenter> {
  return muirMoiraMutatorsResolveInstrumenter(
    muirProteusStorybookPackageName,
    assertBabelTypes,
    corePackage,
  );
}

function assertBabelTypes(
  value: unknown,
  missing: (name: string) => Error,
): asserts value is MuirProteusStorybookBabelTypes {
  const absent = muirProteusStorybookBabelTypeMembers.filter(
    (member) => typeof muirMoiraMutatorsFieldOf(value, member) !== 'function',
  );

  if (absent.length > 0) {
    throw missing(`Babel types with ${absent.join(', ')}`);
  }
}

export async function muirProteusStorybookInstall(
  sets: MuirMoiraMutatorsMutatorSets<MuirProteusStorybookMutator>,
  options: unknown,
  resolve: () => Promise<MuirProteusStorybookInstrumenter>,
  warn: (message: string) => void = console.warn,
  info: (message: string) => void = console.info,
): Promise<void> {
  const mutators = muirMoiraMutatorsSelectMutators(
    muirProteusStorybookPackageName,
    'muirProteusStorybookMutators',
    sets,
    options,
  );
  const instrumenter = await resolve();

  muirMoiraMutatorsCheckNames(
    muirProteusStorybookPackageName,
    mutators,
    instrumenter.allMutators,
  );
  await muirMoiraMutatorsUndoOnThrow([instrumenter.allMutators], async () => {
    muirMoiraMutatorsRegister(
      muirProteusStorybookPackageName,
      instrumenter.allMutators,
      mutators.map(({ name, mutate }) => ({
        name,
        mutate: (path: NodePath) => mutate(path, instrumenter.types),
      })),
    );
    await muirMoiraMutatorsSelfCheck(
      muirProteusStorybookPackageName,
      instrumenter,
      mutators,
    );
  });

  muirMoiraMutatorsWarnUntested(
    muirProteusStorybookPackageName,
    muirProteusStorybookTestedVersion,
    instrumenter,
    warn,
  );
  info(startLine(sets, mutators));
}

function startLine(
  sets: MuirMoiraMutatorsMutatorSets<MuirProteusStorybookMutator>,
  mutators: readonly MuirProteusStorybookMutator[],
): string {
  const optional = mutators.filter(
    (mutator) => !sets.defaults.includes(mutator),
  );

  return (
    `${muirProteusStorybookPackageName}: ${mutators.length} MuirProteusStorybook mutators on, beside Stryker's built-in mutators.` +
    (optional.length > 0
      ? ` Opt-in or experimental: ${optional.map(({ name }) => name).join(', ')}.`
      : '')
  );
}
