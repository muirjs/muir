import assert from 'node:assert/strict';

import { muirMoiraMutatorsFieldOf } from '@muirjs/moira-mutators';
import type { Ignorer } from '@stryker-mutator/api/ignore';

import { muirProteusPlaywrightResolveFromCore } from '../../src/install.ts';
import { instrumentedMutants } from './mutants.ts';

const instrumenter = muirProteusPlaywrightResolveFromCore();

/** Each mutant of `code` as its ignore reason, or `placed` when no ignorer hid it. */
export async function ignorerOutcomes(
  ignorer: Ignorer,
  code: string,
): Promise<string[]> {
  const mutants = await instrumentedMutants(
    await instrumenter,
    [{ name: 'a.ts', content: code }],
    [ignorer],
  );

  return mutants.map((mutant) => {
    const reason = muirMoiraMutatorsFieldOf(mutant, 'statusReason');

    if (muirMoiraMutatorsFieldOf(mutant, 'status') !== 'Ignored') {
      return 'placed';
    }

    return typeof reason === 'string' ? reason : 'Ignored';
  });
}

export async function assertEveryOutcome(
  ignorer: Ignorer,
  code: string,
  outcome: string,
): Promise<void> {
  const found = await ignorerOutcomes(ignorer, code);

  assert.ok(found.length > 0, `no mutants in ${code}`);
  assert.deepEqual(new Set(found), new Set([outcome]), code);
}
