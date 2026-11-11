import type {
  MutatorOptions,
  MutatorSets,
  SampledMutator,
} from '@layzee/stryker-mutator-install';

import { interactionMutator } from './interaction-mutators.ts';
import type { LzStorybookTestMutator } from './mutator.ts';

// In place of `as const`: Stryker mutates nothing inside an `as` expression, which would leave the roster out of a
// mutation run. The literal names are what the option type reads.
function roster<const T extends MutatorSets<LzStorybookTestMutator>>(
  sets: T,
): T {
  return sets;
}

export const mutatorSets = roster({
  defaults: [interactionMutator()],
  optIn: [],
  experimental: [],
});

type NamesIn<TTier extends readonly SampledMutator[]> = TTier[number]['name'];

export type LzStorybookTestMutatorOptions = MutatorOptions<
  NamesIn<(typeof mutatorSets)['optIn']>,
  NamesIn<(typeof mutatorSets)['experimental']>
>;
