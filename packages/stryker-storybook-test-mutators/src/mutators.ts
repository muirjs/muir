import type {
  MutatorOptions,
  MutatorSets,
  SampledMutator,
} from '@layzee/stryker-mutator-install';

import {
  assertionBeforeMutator,
  clickFocusMutator,
  interactionMutator,
  interactionRepeatMutator,
  interactionTargetMutator,
} from './interaction-mutators.ts';
import type { LzStorybookTestMutator } from './mutator.ts';
import { spyStubMutator } from './spy-stub.ts';
import { storyGlobalsMutator } from './story-globals.ts';
import { waitForMutator } from './wait-for.ts';

// In place of `as const`: Stryker mutates nothing inside an `as` expression, which would leave the roster out of a
// mutation run. The literal names are what the option type reads.
function roster<const T extends MutatorSets<LzStorybookTestMutator>>(
  sets: T,
): T {
  return sets;
}

export const mutatorSets = roster({
  defaults: [
    interactionMutator(),
    clickFocusMutator(),
    interactionTargetMutator(),
  ],
  optIn: [interactionRepeatMutator()],
  experimental: [
    waitForMutator(),
    assertionBeforeMutator(),
    spyStubMutator(),
    storyGlobalsMutator(),
  ],
});

type NamesIn<TTier extends readonly SampledMutator[]> = TTier[number]['name'];

export type LzStorybookTestMutatorOptions = MutatorOptions<
  NamesIn<(typeof mutatorSets)['optIn']>,
  NamesIn<(typeof mutatorSets)['experimental']>
>;
