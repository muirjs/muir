import {
  muirMoiraMutatorsInstallBabelMutators,
  type MuirMoiraMutatorsMutatorOptions,
} from '@muirjs/moira-mutators';
import { muirProteusJsMutatorSets } from './mutators.ts';
import {
  muirProteusJsPackageName,
  muirProteusJsTestedVersion,
} from './package-name.ts';

/** The mutators that run only when a config turns them on, by name or all with `extended`. */
export type MuirProteusJsOptInMutator =
  (typeof muirProteusJsMutatorSets.optIn)[number]['name'];

/** The mutators measured on too few projects to run by default, turned on inside `experimental`. */
export type MuirProteusJsExperimentalMutator =
  (typeof muirProteusJsMutatorSets.experimental)[number]['name'];

export type MuirProteusJsMutatorOptions = MuirMoiraMutatorsMutatorOptions<
  MuirProteusJsOptInMutator,
  MuirProteusJsExperimentalMutator
>;

/**
 * Installs this package's mutators into Stryker: the defaults and those `options` turns on. A Stryker configuration file
 * awaits it, so that an error in the install stops the run; Stryker only warns when a module in `plugins` fails to load.
 */
export async function muirProteusJsMutators(
  options?: MuirProteusJsMutatorOptions,
): Promise<void> {
  await muirMoiraMutatorsInstallBabelMutators({
    packageName: muirProteusJsPackageName,
    // Stryker disable next-line StringLiteral: only the error for a tier without mutators names it, and this package has both tiers
    installName: 'muirProteusJsMutators',
    testedVersion: muirProteusJsTestedVersion,
    sets: muirProteusJsMutatorSets,
    options,
  });
}
