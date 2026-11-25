import {
  muirMoiraMutatorsInstallBabelMutators,
  type MuirMoiraMutatorsMutatorOptions,
} from '@muirjs/moira-mutators';
import { muirProteusNodeTestTestMutatorSets } from './mutators.ts';
import {
  muirProteusNodeTestPackageName,
  muirProteusNodeTestTestedVersion,
} from './package-name.ts';

/** The mutators measured on too few projects to run by default, turned on inside `experimental`. */
export type MuirProteusNodeTestExperimentalMutator =
  (typeof muirProteusNodeTestTestMutatorSets.experimental)[number]['name'];

export type MuirProteusNodeTestMutatorOptions = MuirMoiraMutatorsMutatorOptions<
  never,
  MuirProteusNodeTestExperimentalMutator
>;

/**
 * Replaces Stryker's mutators with this package's mutators for test code: the defaults and those `options` turns on. A
 * Stryker configuration file that mutates test files awaits it, so that an error in the install stops the run; Stryker
 * only warns when a module in `plugins` fails to load.
 */
export async function muirProteusNodeTestMutators(
  options?: MuirProteusNodeTestMutatorOptions,
): Promise<void> {
  await muirMoiraMutatorsInstallBabelMutators({
    packageName: muirProteusNodeTestPackageName,
    installName: 'muirProteusNodeTestMutators',
    testedVersion: muirProteusNodeTestTestedVersion,
    removeBuiltIns: true,
    sets: muirProteusNodeTestTestMutatorSets,
    options,
  });
}
