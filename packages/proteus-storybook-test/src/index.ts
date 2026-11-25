import { install, resolveFromCore } from './install.ts';
import { mutatorSets, type LzStorybookTestMutatorOptions } from './mutators.ts';

export type { LzStorybookTestMutatorOptions } from './mutators.ts';

/**
 * Turns off Stryker's 17 built-in mutators and installs this package's mutators for Storybook play functions. A
 * Stryker configuration file awaits it, so that an error in the install stops the run.
 */
export async function lzStorybookTestMutators(
  options?: LzStorybookTestMutatorOptions,
): Promise<void> {
  await install(mutatorSets, options, resolveFromCore);
}
