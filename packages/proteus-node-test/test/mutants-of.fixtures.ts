import {
  muirMoiraNodeTestResolveFromCore,
  muirMoiraNodeTestToNodeMutator,
  type MuirMoiraNodeTestInstrumentedMutant,
  type MuirMoiraNodeTestMutator,
} from '@muirjs/moira-node-test';
import { muirProteusNodeTestPackageName } from '../src/package-name.ts';

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
        muirProteusNodeTestPackageName,
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
