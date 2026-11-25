import { install, resolveFromCore } from './install.ts';
import { mutatorSets, type LzMswMutatorOptions } from './mutators.ts';

export type { LzMswMutatorOptions } from './mutators.ts';

/**
 * Installs this package's mutators for the responses of msw request handlers beside Stryker's built-in mutators. A
 * Stryker configuration file awaits it, so that an error in the install stops the run.
 */
export async function lzMswMutators(
  options?: LzMswMutatorOptions,
): Promise<void> {
  await install(mutatorSets, options, resolveFromCore);
}
