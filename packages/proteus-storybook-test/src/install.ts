import type { NodePath } from '@babel/core';
import {
  muirMoiraMutatorsBuiltInNames,
  muirMoiraMutatorsCheckBuiltInsRemoved,
  muirMoiraMutatorsCheckNames,
  muirMoiraMutatorsCorePackageJson,
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsRegister,
  muirMoiraMutatorsRemoveBuiltIns,
  muirMoiraMutatorsResolveInstrumenter,
  muirMoiraMutatorsSelectMutators,
  muirMoiraMutatorsSelfCheck,
  muirMoiraMutatorsUndoOnThrow,
  muirMoiraMutatorsWarnUntested,
  type MuirMoiraMutatorsInstrumenter as CoreInstrumenter,
  type MuirMoiraMutatorsMutatorSets,
} from '@muirjs/moira-mutators';

import {
  muirProteusStorybookTestBabelTypeMembers,
  type MuirProteusStorybookTestBabelTypes,
  type MuirProteusStorybookTestMutator,
} from './mutator.ts';
import { muirProteusStorybookTestPackageName } from './package-name.ts';

export type MuirProteusStorybookTestInstrumenter =
  CoreInstrumenter<MuirProteusStorybookTestBabelTypes>;

export const muirProteusStorybookTestTestedVersion = '10.1.1';

export function muirProteusStorybookTestResolveFromCore(
  corePackage: string = muirMoiraMutatorsCorePackageJson(),
): Promise<MuirProteusStorybookTestInstrumenter> {
  return muirMoiraMutatorsResolveInstrumenter(
    muirProteusStorybookTestPackageName,
    muirProteusStorybookTestAssertBabelTypes,
    corePackage,
  );
}

export function muirProteusStorybookTestAssertBabelTypes(
  value: unknown,
  missing: (name: string) => Error,
): asserts value is MuirProteusStorybookTestBabelTypes {
  const absent = muirProteusStorybookTestBabelTypeMembers.filter(
    (member) => typeof muirMoiraMutatorsFieldOf(value, member) !== 'function',
  );

  if (absent.length > 0) {
    throw missing(`Babel types with ${absent.join(', ')}`);
  }
}

export async function muirProteusStorybookTestInstall(
  sets: MuirMoiraMutatorsMutatorSets<MuirProteusStorybookTestMutator>,
  options: unknown,
  resolve: () => Promise<MuirProteusStorybookTestInstrumenter>,
  warn: (message: string) => void = console.warn,
  info: (message: string) => void = console.info,
): Promise<void> {
  const mutators = muirMoiraMutatorsSelectMutators(
    muirProteusStorybookTestPackageName,
    'muirProteusStorybookTestMutators',
    sets,
    options,
  );
  const instrumenter = await resolve();

  muirMoiraMutatorsCheckNames(
    muirProteusStorybookTestPackageName,
    mutators,
    instrumenter.allMutators,
  );
  await muirMoiraMutatorsUndoOnThrow([instrumenter.allMutators], async () => {
    muirMoiraMutatorsRemoveBuiltIns(
      muirProteusStorybookTestPackageName,
      instrumenter,
      warn,
    );
    muirMoiraMutatorsRegister(
      muirProteusStorybookTestPackageName,
      instrumenter.allMutators,
      mutators.map(({ name, mutate }) => ({
        name,
        mutate: (path: NodePath) => mutate(path, instrumenter.types),
      })),
    );
    await muirMoiraMutatorsSelfCheck(
      muirProteusStorybookTestPackageName,
      instrumenter,
      mutators,
    );
    await muirMoiraMutatorsCheckBuiltInsRemoved(
      muirProteusStorybookTestPackageName,
      instrumenter,
    );
  });

  muirMoiraMutatorsWarnUntested(
    muirProteusStorybookTestPackageName,
    muirProteusStorybookTestTestedVersion,
    instrumenter,
    warn,
  );
  info(startLine(sets, mutators));
}

function startLine(
  sets: MuirMoiraMutatorsMutatorSets<MuirProteusStorybookTestMutator>,
  mutators: readonly MuirProteusStorybookTestMutator[],
): string {
  const optional = mutators.filter(
    (mutator) => !sets.defaults.includes(mutator),
  );

  return (
    `${muirProteusStorybookTestPackageName}: Stryker's ${muirMoiraMutatorsBuiltInNames.length} built-in mutators are off for every file in this run; ` +
    `${mutators.length} MuirProteusStorybookTest mutators on.` +
    (optional.length > 0
      ? ` Opt-in or experimental: ${optional.map(({ name }) => name).join(', ')}.`
      : '')
  );
}
