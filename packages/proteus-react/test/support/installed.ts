// Calls install() with the instrumenter a test passes, so the test controls which instrumenter gets the mutators.
import { muirProteusReactImplicitRoles } from '../../src/implicit-roles.ts';
import {
  muirProteusReactInstall,
  type MuirProteusReactInstrumenter,
} from '../../src/install.ts';
import {
  muirProteusReactMutatorsFor,
  type MuirProteusReactMutatorName,
} from '../../src/mutators.ts';

export const mutatorNames: readonly MuirProteusReactMutatorName[] =
  muirProteusReactMutatorsFor(muirProteusReactImplicitRoles).map(
    ({ name }) => name,
  );

export const ours: ReadonlySet<string> = new Set(mutatorNames);

export async function installInto<T extends MuirProteusReactInstrumenter>(
  instrumenter: T,
): Promise<T> {
  await muirProteusReactInstall(
    muirProteusReactMutatorsFor(muirProteusReactImplicitRoles),
    async () => [instrumenter],
  );

  return instrumenter;
}
