import {
  muirMoiraMutatorsResolveBabelInstrumenter,
  muirMoiraMutatorsToStrykerMutator,
  type MuirMoiraMutatorsMutant,
  type MuirMoiraMutatorsBabelMutator,
} from '@muirjs/moira-mutators';
import { muirProteusNodeTestPackageName } from '../src/package-name.ts';

export const strict = "import assert from 'node:assert/strict';\n";

export async function instrumentWith(
  mutator: MuirMoiraMutatorsBabelMutator,
  source: string,
): Promise<readonly MuirMoiraMutatorsMutant[]> {
  const instrumenter = await muirMoiraMutatorsResolveBabelInstrumenter(
    muirProteusNodeTestPackageName,
  );

  return instrumenter.instrument(
    [{ name: 'sample.ts', content: source }],
    [muirMoiraMutatorsToStrykerMutator(mutator, instrumenter.types)],
  );
}

export async function mutantsOf(
  mutator: MuirMoiraMutatorsBabelMutator,
  source: string,
): Promise<string[]> {
  const mutants = await instrumentWith(mutator, source);

  return mutants.map(({ replacement }) => replacement.replace(/\s+/g, ' '));
}
