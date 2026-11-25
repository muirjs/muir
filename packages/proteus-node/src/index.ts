import {
  muirMoiraMutatorsInstallBabelMutators,
  type MuirMoiraMutatorsMutatorOptions,
} from '@muirjs/moira-mutators';
import { muirProteusNodeMutatorSets } from './mutators.ts';
import {
  muirProteusNodePackageName,
  muirProteusNodeTestedVersion,
} from './package-name.ts';

/** The mutators that run only when a config turns them on, by name or all with `extended`. */
export type MuirProteusNodeOptInMutator =
  (typeof muirProteusNodeMutatorSets.optIn)[number]['name'];

/** The mutators measured on too few projects to run by default, turned on inside `experimental`. */
export type MuirProteusNodeExperimentalMutator =
  (typeof muirProteusNodeMutatorSets.experimental)[number]['name'];

export type MuirProteusNodeMutatorOptions = MuirMoiraMutatorsMutatorOptions<
  MuirProteusNodeOptInMutator,
  MuirProteusNodeExperimentalMutator
>;

/**
 * Installs this package's mutators into Stryker: the defaults and those `options` turns on. A Stryker configuration file
 * awaits it, so that an error in the install stops the run; Stryker only warns when a module in `plugins` fails to load.
 */
export async function muirProteusNodeMutators(
  options?: MuirProteusNodeMutatorOptions,
): Promise<void> {
  await muirMoiraMutatorsInstallBabelMutators({
    packageName: muirProteusNodePackageName,
    // Stryker disable next-line StringLiteral: only the error for a tier without mutators names it, and this package has both tiers
    installName: 'muirProteusNodeMutators',
    testedVersion: muirProteusNodeTestedVersion,
    sets: muirProteusNodeMutatorSets,
    options,
  });
}
