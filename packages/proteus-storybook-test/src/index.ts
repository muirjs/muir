import {
  muirProteusStorybookTestInstall,
  muirProteusStorybookTestResolveFromCore,
} from './install.ts';
import {
  muirProteusStorybookTestMutatorSets,
  type MuirProteusStorybookTestMutatorOptions,
} from './mutators.ts';

export type { MuirProteusStorybookTestMutatorOptions } from './mutators.ts';

/**
 * Turns off Stryker's 17 built-in mutators and installs this package's mutators for Storybook play functions. A
 * Stryker configuration file awaits it, so that an error in the install stops the run.
 */
export async function muirProteusStorybookTestMutators(
  options?: MuirProteusStorybookTestMutatorOptions,
): Promise<void> {
  await muirProteusStorybookTestInstall(
    muirProteusStorybookTestMutatorSets,
    options,
    muirProteusStorybookTestResolveFromCore,
  );
}
