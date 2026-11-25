import {
  muirMoiraNodeTestInstall,
  muirMoiraNodeTestSelectMutators,
  type MuirMoiraNodeTestMutatorOptions,
} from '@muirjs/moira-node-test';
import { muirProteusJsMutatorSets } from './mutators.ts';
import {
  muirProteusJsCorePeerRange,
  muirProteusJsPackageName,
} from './package-name.ts';

/** The mutators that run only when a config turns them on, by name or all with `extended`. */
export type MuirProteusJsOptInMutator =
  (typeof muirProteusJsMutatorSets.optIn)[number]['name'];

/** The mutators measured on too few projects to run by default, turned on inside `experimental`. */
export type MuirProteusJsExperimentalMutator =
  (typeof muirProteusJsMutatorSets.experimental)[number]['name'];

export type MuirProteusJsMutatorOptions = MuirMoiraNodeTestMutatorOptions<
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
  await muirMoiraNodeTestInstall({
    packageName: muirProteusJsPackageName,
    corePeerRange: muirProteusJsCorePeerRange,
    mode: 'add',
    mutators: muirMoiraNodeTestSelectMutators(
      muirProteusJsPackageName,
      muirProteusJsMutatorSets,
      options,
    ),
  });
}
