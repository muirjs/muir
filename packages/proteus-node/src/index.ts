import {
  muirMoiraNodeTestInstall,
  muirMoiraNodeTestSelectMutators,
  type MuirMoiraNodeTestMutatorOptions,
} from '@muirjs/moira-node-test';
import { muirProteusNodeMutatorSets } from './mutators.ts';
import {
  muirProteusNodeCorePeerRange,
  muirProteusNodePackageName,
} from './package-name.ts';

/** The mutators that run only when a config turns them on, by name or all with `extended`. */
export type MuirProteusNodeOptInMutator =
  (typeof muirProteusNodeMutatorSets.optIn)[number]['name'];

/** The mutators measured on too few projects to run by default, turned on inside `experimental`. */
export type MuirProteusNodeExperimentalMutator =
  (typeof muirProteusNodeMutatorSets.experimental)[number]['name'];

export type MuirProteusNodeMutatorOptions = MuirMoiraNodeTestMutatorOptions<
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
  await muirMoiraNodeTestInstall({
    packageName: muirProteusNodePackageName,
    corePeerRange: muirProteusNodeCorePeerRange,
    mode: 'add',
    mutators: muirMoiraNodeTestSelectMutators(
      muirProteusNodePackageName,
      muirProteusNodeMutatorSets,
      options,
    ),
  });
}
