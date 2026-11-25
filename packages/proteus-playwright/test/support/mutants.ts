import {
  muirMoiraMutatorsCoreInstrument,
  muirMoiraMutatorsFieldOf,
  type MuirMoiraMutatorsSourceFile,
} from '@muirjs/moira-mutators';
import type { Ignorer } from '@stryker-mutator/api/ignore';

import type { MuirProteusPlaywrightInstrumenter } from '../../src/install.ts';
import { muirProteusPlaywrightPackageName } from '../../src/package-name.ts';

export interface Mutant {
  readonly fileName: string;
  readonly mutatorName: string;
  readonly replacement: string;
}

/** The mutants the core instrumenter makes of `files`, as it returns them. */
export async function instrumentedMutants(
  instrumenter: MuirProteusPlaywrightInstrumenter,
  files: readonly MuirMoiraMutatorsSourceFile[],
  ignorers: readonly Ignorer[] = [],
): Promise<readonly unknown[]> {
  const instrument = await muirMoiraMutatorsCoreInstrument({
    packageName: muirProteusPlaywrightPackageName,
    ...instrumenter,
  });
  const mutants = muirMoiraMutatorsFieldOf(
    await instrument(files, [], ignorers),
    'mutants',
  );

  if (!Array.isArray(mutants)) {
    throw new Error('Instrumenter.instrument() gave no mutants');
  }

  const list: readonly unknown[] = mutants;

  return list;
}

export async function mutantsOf(
  instrumenter: MuirProteusPlaywrightInstrumenter,
  files: readonly MuirMoiraMutatorsSourceFile[],
): Promise<readonly Mutant[]> {
  const mutants = await instrumentedMutants(instrumenter, files);

  return mutants.map((mutant) => ({
    fileName: String(muirMoiraMutatorsFieldOf(mutant, 'fileName')),
    mutatorName: String(muirMoiraMutatorsFieldOf(mutant, 'mutatorName')),
    replacement: String(muirMoiraMutatorsFieldOf(mutant, 'replacement')),
  }));
}
