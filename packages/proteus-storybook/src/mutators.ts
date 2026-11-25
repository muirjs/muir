import type {
  MuirMoiraMutatorsMutatorOptions,
  MuirMoiraMutatorsMutatorSets,
  MuirMoiraMutatorsSampledMutator,
} from '@muirjs/moira-mutators';

import { muirProteusStorybookArgsMutator } from './args.ts';
import type { MuirProteusStorybookMutator } from './mutator.ts';

// In place of `as const`: Stryker mutates nothing inside an `as` expression, which would leave the roster out of a
// mutation run. The literal names are what the option type reads.
function roster<
  const T extends MuirMoiraMutatorsMutatorSets<MuirProteusStorybookMutator>,
>(sets: T): T {
  return sets;
}

export const muirProteusStorybookMutatorSets = roster({
  defaults: [],
  optIn: [muirProteusStorybookArgsMutator()],
  experimental: [],
});

type NamesIn<TTier extends readonly MuirMoiraMutatorsSampledMutator[]> =
  TTier[number]['name'];

export type MuirProteusStorybookMutatorOptions =
  MuirMoiraMutatorsMutatorOptions<
    NamesIn<(typeof muirProteusStorybookMutatorSets)['optIn']>,
    NamesIn<(typeof muirProteusStorybookMutatorSets)['experimental']>
  >;
