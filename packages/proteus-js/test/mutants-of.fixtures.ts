import {
  muirMoiraMutatorsBuiltInNames,
  muirMoiraMutatorsResolveBabelInstrumenter,
  muirMoiraMutatorsToStrykerMutator,
  type MuirMoiraMutatorsMutant,
  type MuirMoiraMutatorsListedMutator,
  type MuirMoiraMutatorsBabelMutator,
} from '@muirjs/moira-mutators';
import { muirProteusJsPackageName } from '../src/package-name.ts';

export async function instrumentWith(
  mutator: MuirMoiraMutatorsBabelMutator,
  source: string,
): Promise<readonly MuirMoiraMutatorsMutant[]> {
  const instrumenter = await muirMoiraMutatorsResolveBabelInstrumenter(
    muirProteusJsPackageName,
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

/** The mutator name and replacement of each mutant that `mutators` make together in `source`. */
export async function mutantsOfAll(
  mutators: readonly MuirMoiraMutatorsBabelMutator[],
  source: string,
): Promise<string[][]> {
  const instrumenter = await muirMoiraMutatorsResolveBabelInstrumenter(
    muirProteusJsPackageName,
  );
  const mutants = await instrumenter.instrument(
    [{ name: 'sample.ts', content: source }],
    mutators.map((mutator) =>
      muirMoiraMutatorsToStrykerMutator(mutator, instrumenter.types),
    ),
  );

  return mutants.map(({ mutatorName, replacement }) => [
    mutatorName,
    replacement,
  ]);
}

/** The mutator names of the statement removals in `source`: by Stryker's mutators alone, then with `mutator` too. */
export async function removalsNextToBuiltIns(
  mutator: MuirMoiraMutatorsBabelMutator,
  source: string,
): Promise<[string[], string[]]> {
  const instrumenter = await muirMoiraMutatorsResolveBabelInstrumenter(
    muirProteusJsPackageName,
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
