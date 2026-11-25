import type {
  MuirMoiraMutatorsMutatorOptions,
  MuirMoiraMutatorsMutatorSets,
  MuirMoiraMutatorsSampledMutator,
} from '@muirjs/moira-mutators';

import type { MuirProteusMswMutator } from './mutator.ts';
import { muirProteusMswResponseMutator } from './msw-response.ts';

// In place of `as const`: Stryker mutates nothing inside an `as` expression, which would leave the roster out of a
// mutation run. The literal names are what the option type reads.
function roster<
  const T extends MuirMoiraMutatorsMutatorSets<MuirProteusMswMutator>,
>(sets: T): T {
  return sets;
}

export const muirProteusMswMutatorSets = roster({
  defaults: [muirProteusMswResponseMutator()],
  optIn: [],
  experimental: [],
});

type NamesIn<TTier extends readonly MuirMoiraMutatorsSampledMutator[]> =
  TTier[number]['name'];

export type MuirProteusMswMutatorOptions = MuirMoiraMutatorsMutatorOptions<
  NamesIn<(typeof muirProteusMswMutatorSets)['optIn']>,
  NamesIn<(typeof muirProteusMswMutatorSets)['experimental']>
>;
