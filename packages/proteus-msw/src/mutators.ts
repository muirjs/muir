import type {
  MutatorOptions,
  MutatorSets,
  SampledMutator,
} from '@muirjs/moira-mutators';

import type { LzMswMutator } from './mutator.ts';
import { mswResponseMutator } from './msw-response.ts';

// In place of `as const`: Stryker mutates nothing inside an `as` expression, which would leave the roster out of a
// mutation run. The literal names are what the option type reads.
function roster<const T extends MutatorSets<LzMswMutator>>(sets: T): T {
  return sets;
}

export const mutatorSets = roster({
  defaults: [mswResponseMutator()],
  optIn: [],
  experimental: [],
});

type NamesIn<TTier extends readonly SampledMutator[]> = TTier[number]['name'];

export type LzMswMutatorOptions = MutatorOptions<
  NamesIn<(typeof mutatorSets)['optIn']>,
  NamesIn<(typeof mutatorSets)['experimental']>
>;
