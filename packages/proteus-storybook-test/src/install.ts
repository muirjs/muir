import type { NodePath } from '@babel/core';
import {
  muirMoiraMutatorsBuiltInNames,
  muirMoiraMutatorsCorePackageJsons,
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsInstall,
  muirMoiraMutatorsResolveInstrumenter,
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
  corePackage: string = muirMoiraMutatorsCorePackageJsons()[0],
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
  resolve: () => Promise<readonly MuirProteusStorybookTestInstrumenter[]>,
  warn: (message: string) => void = console.warn,
  info: (message: string) => void = console.info,
): Promise<void> {
  const mutators = await muirMoiraMutatorsInstall({
    packageName: muirProteusStorybookTestPackageName,
    installName: 'muirProteusStorybookTestMutators',
    testedVersion: muirProteusStorybookTestTestedVersion,
    removeBuiltIns: true,
    sets,
    options,
    resolve,
    toListed: ({ name, mutate }, { types }) => ({
      name,
      mutate: (path: NodePath) => mutate(path, types),
    }),
    warn,
  });

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
