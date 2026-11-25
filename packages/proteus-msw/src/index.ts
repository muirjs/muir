import {
  muirProteusMswInstall,
  muirProteusMswResolveFromCore,
} from './install.ts';
import {
  muirProteusMswMutatorSets,
  type MuirProteusMswMutatorOptions,
} from './mutators.ts';

export type { MuirProteusMswMutatorOptions } from './mutators.ts';

/**
 * Installs this package's mutators for the responses of msw request handlers beside Stryker's built-in mutators. A
 * Stryker configuration file awaits it, so that an error in the install stops the run.
 */
export async function muirProteusMswMutators(
  options?: MuirProteusMswMutatorOptions,
): Promise<void> {
  await muirProteusMswInstall(
    muirProteusMswMutatorSets,
    options,
    muirProteusMswResolveFromCore,
  );
}
