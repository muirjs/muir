import {
  muirMoiraNodeTestIsOwn,
  muirMoiraNodeTestResolveFromCore,
  muirMoiraNodeTestToNodeMutator,
  type MuirMoiraNodeTestInstrumentedMutant,
  type MuirMoiraNodeTestListedMutator,
  type MuirMoiraNodeTestMutator,
} from '@muirjs/moira-node-test';
import { muirProteusNodePackageName } from '../src/package-name.ts';

export const strict = "import assert from 'node:assert/strict';\n";

export async function instrumentWith(
  mutator: MuirMoiraNodeTestMutator,
  source: string,
): Promise<readonly MuirMoiraNodeTestInstrumentedMutant[]> {
  const instrumenter = await muirMoiraNodeTestResolveFromCore();

  return instrumenter.instrument(
    [{ name: 'sample.ts', content: source }],
    [
      muirMoiraNodeTestToNodeMutator(
        mutator,
        instrumenter.types,
        muirProteusNodePackageName,
      ),
    ],
  );
}

export async function mutantsOf(
  mutator: MuirMoiraNodeTestMutator,
  source: string,
): Promise<string[]> {
  const mutants = await instrumentWith(mutator, source);

  return mutants.map(({ replacement }) => replacement.replace(/\s+/g, ' '));
}

/** The mutator names of the statement removals in `source`: by Stryker's mutators alone, then with `mutator` too. */
export async function removalsNextToBuiltIns(
  mutator: MuirMoiraNodeTestMutator,
  source: string,
): Promise<[string[], string[]]> {
  const instrumenter = await muirMoiraNodeTestResolveFromCore();
  const builtIns = instrumenter.allMutators.filter(
    (listed) => !muirMoiraNodeTestIsOwn(listed),
  );
  const removals = async (
    mutators: readonly MuirMoiraNodeTestListedMutator[],
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
      muirMoiraNodeTestToNodeMutator(
        mutator,
        instrumenter.types,
        muirProteusNodePackageName,
      ),
    ]),
  ];
}
