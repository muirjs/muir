import {
  muirMoiraNodeTestInstall,
  muirMoiraNodeTestSelectMutators,
  type MuirMoiraNodeTestMutatorOptions,
} from '@muirjs/moira-node-test';
import { muirProteusNodeTestTestMutatorSets } from './mutators.ts';
import {
  muirProteusNodeTestCorePeerRange,
  muirProteusNodeTestPackageName,
} from './package-name.ts';

/** The mutators measured on too few projects to run by default, turned on inside `experimental`. */
export type MuirProteusNodeTestExperimentalMutator =
  (typeof muirProteusNodeTestTestMutatorSets.experimental)[number]['name'];

export type MuirProteusNodeTestMutatorOptions = MuirMoiraNodeTestMutatorOptions<
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
  await muirMoiraNodeTestInstall({
    packageName: muirProteusNodeTestPackageName,
    corePeerRange: muirProteusNodeTestCorePeerRange,
    mode: 'replace',
    mutators: muirMoiraNodeTestSelectMutators(
      muirProteusNodeTestPackageName,
      muirProteusNodeTestTestMutatorSets,
      options,
    ),
  });
}
