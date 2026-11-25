import { muirMoiraMutatorsResolveEachCore } from '@muirjs/moira-mutators';

import {
  muirProteusStorybookInstall,
  muirProteusStorybookResolveFromCore,
} from './install.ts';
import {
  muirProteusStorybookMutatorSets,
  type MuirProteusStorybookMutatorOptions,
} from './mutators.ts';

export type { MuirProteusStorybookMutatorOptions } from './mutators.ts';

/**
 * Installs this package's mutators for Storybook story data beside Stryker's built-in mutators. A Stryker configuration
 * file awaits it, so that an error in the install stops the run.
 */
export async function muirProteusStorybookMutators(
  options?: MuirProteusStorybookMutatorOptions,
): Promise<void> {
  await muirProteusStorybookInstall(
    muirProteusStorybookMutatorSets,
    options,
    () => muirMoiraMutatorsResolveEachCore(muirProteusStorybookResolveFromCore),
  );
}
