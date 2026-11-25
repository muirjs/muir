import { install, resolveFromCore } from './install.ts';
import { mutatorSets, type LzStorybookMutatorOptions } from './mutators.ts';

export type { LzStorybookMutatorOptions } from './mutators.ts';

/**
 * Installs this package's mutators for Storybook story data beside Stryker's built-in mutators. A Stryker configuration
 * file awaits it, so that an error in the install stops the run.
 */
export async function lzStorybookMutators(
  options?: LzStorybookMutatorOptions,
): Promise<void> {
  await install(mutatorSets, options, resolveFromCore);
}
