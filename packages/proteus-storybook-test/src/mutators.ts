import type {
  MuirMoiraMutatorsMutatorOptions,
  MuirMoiraMutatorsMutatorSets,
  MuirMoiraMutatorsSampledMutator,
} from '@muirjs/moira-mutators';

import {
  muirProteusStorybookTestAssertionBeforeMutator,
  muirProteusStorybookTestClickFocusMutator,
  muirProteusStorybookTestInteractionMutator,
  muirProteusStorybookTestInteractionRepeatMutator,
  muirProteusStorybookTestInteractionTargetMutator,
} from './interaction-mutators.ts';
import type { MuirProteusStorybookTestMutator } from './mutator.ts';
import {
  muirProteusStorybookTestSpyStubMutator,
  muirProteusStorybookTestSpyStubOutcomeMutator,
} from './spy-stub.ts';
import { muirProteusStorybookTestStoryGlobalsMutator } from './story-globals.ts';
import { muirProteusStorybookTestWaitForMutator } from './wait-for.ts';

// In place of `as const`: Stryker mutates nothing inside an `as` expression, which would leave the roster out of a
// mutation run. The literal names are what the option type reads.
function roster<
  const T extends MuirMoiraMutatorsMutatorSets<MuirProteusStorybookTestMutator>,
>(sets: T): T {
  return sets;
}

export const muirProteusStorybookTestMutatorSets = roster({
  defaults: [
    muirProteusStorybookTestInteractionMutator(),
    muirProteusStorybookTestClickFocusMutator(),
  ],
  optIn: [muirProteusStorybookTestInteractionRepeatMutator()],
  experimental: [
    muirProteusStorybookTestInteractionTargetMutator(),
    muirProteusStorybookTestWaitForMutator(),
    muirProteusStorybookTestAssertionBeforeMutator(),
    muirProteusStorybookTestSpyStubMutator(),
    muirProteusStorybookTestSpyStubOutcomeMutator(),
    muirProteusStorybookTestStoryGlobalsMutator(),
  ],
});

type NamesIn<TTier extends readonly MuirMoiraMutatorsSampledMutator[]> =
  TTier[number]['name'];

export type MuirProteusStorybookTestMutatorOptions =
  MuirMoiraMutatorsMutatorOptions<
    NamesIn<(typeof muirProteusStorybookTestMutatorSets)['optIn']>,
    NamesIn<(typeof muirProteusStorybookTestMutatorSets)['experimental']>
  >;
