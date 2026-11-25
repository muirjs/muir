import {
  muirMoiraMutatorsBuiltInNames,
  muirMoiraMutatorsResolveBabelInstrumenter,
  muirMoiraMutatorsToStrykerMutator,
  type MuirMoiraMutatorsMutant,
  type MuirMoiraMutatorsListedMutator,
  type MuirMoiraMutatorsBabelMutator,
} from '@muirjs/moira-mutators';
import { muirProteusNodePackageName } from '../src/package-name.ts';

export const strict = "import assert from 'node:assert/strict';\n";

export async function instrumentWith(
  mutator: MuirMoiraMutatorsBabelMutator,
  source: string,
): Promise<readonly MuirMoiraMutatorsMutant[]> {
  const instrumenter = await muirMoiraMutatorsResolveBabelInstrumenter(
    muirProteusNodePackageName,
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

/** The mutator names of the statement removals in `source`: by Stryker's mutators alone, then with `mutator` too. */
export async function removalsNextToBuiltIns(
  mutator: MuirMoiraMutatorsBabelMutator,
  source: string,
): Promise<[string[], string[]]> {
  const instrumenter = await muirMoiraMutatorsResolveBabelInstrumenter(
    muirProteusNodePackageName,
  );
  const builtIns = instrumenter.allMutators.filter(({ name }) =>
    muirMoiraMutatorsBuiltInNames.includes(name),
  );
  const removals = async (
    mutators: readonly MuirMoiraMutatorsListedMutator[],
  ) =>
    (
      await instrumenter.instrument(
        [{ name: 'sample.ts', content: source }],
        mutators,
      )
    )
      .filter(({ replacement }) => replacement === ';')
      .map(({ mutatorName }) => mutatorName);

  return [
    await removals(builtIns),
    await removals([
      ...builtIns,
      muirMoiraMutatorsToStrykerMutator(mutator, instrumenter.types),
    ]),
  ];
}
