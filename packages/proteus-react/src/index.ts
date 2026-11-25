import { muirProteusReactImplicitRoles } from './implicit-roles.ts';
import { muirProteusReactInstall } from './install.ts';
import { muirProteusReactMutatorsFor } from './mutators.ts';

/** This package has no opt-in or experimental mutators yet, so the options name none. */
export type MuirProteusReactMutatorOptions = Readonly<Record<string, never>>;

/**
 * Installs this package's mutators into Stryker. A Stryker configuration file awaits it, so that an error in the install
 * stops the run; Stryker only warns when a module in `plugins` fails to load.
 */
export async function muirProteusReactMutators(
  options?: MuirProteusReactMutatorOptions,
): Promise<void> {
  await muirProteusReactInstall(
    muirProteusReactMutatorsFor(muirProteusReactImplicitRoles),
    undefined,
    undefined,
    options,
  );
}
