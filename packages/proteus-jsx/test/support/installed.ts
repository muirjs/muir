// Calls install() with the instrumenter a test passes, so the test controls which instrumenter gets the mutators.
import { muirProteusJsxImplicitRoles } from '../../src/implicit-roles.ts';
import {
  muirProteusJsxInstall,
  type MuirProteusJsxInstrumenter,
} from '../../src/install.ts';
import {
  muirProteusJsxMutatorsFor,
  type MuirProteusJsxMutatorName,
} from '../../src/mutators.ts';

export const mutatorNames: readonly MuirProteusJsxMutatorName[] =
  muirProteusJsxMutatorsFor(muirProteusJsxImplicitRoles).map(
    ({ name }) => name,
  );

export const ours: ReadonlySet<string> = new Set(mutatorNames);

export async function installInto<T extends MuirProteusJsxInstrumenter>(
  instrumenter: T,
): Promise<T> {
  await muirProteusJsxInstall(
    muirProteusJsxMutatorsFor(muirProteusJsxImplicitRoles),
    async () => instrumenter,
  );

  return instrumenter;
}
