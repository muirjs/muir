import {
  muirMoiraMutatorsAllMutators,
  type MuirMoiraMutatorsBabelMutator,
  type MuirMoiraMutatorsMutatorSets,
} from '@muirjs/moira-mutators';
import { muirProteusNodeTestAssertCall } from './node-test-assert-call.ts';
import { muirProteusNodeTestAssertValidator } from './node-test-assert-validator.ts';
import { muirProteusNodeTestCatchAssert } from './node-test-catch-assert.ts';

export const muirProteusNodeTestTestMutatorSets = {
  defaults: [muirProteusNodeTestAssertCall, muirProteusNodeTestAssertValidator],
  optIn: [],
  experimental: [muirProteusNodeTestCatchAssert],
} satisfies MuirMoiraMutatorsMutatorSets<MuirMoiraMutatorsBabelMutator>;

export const muirProteusNodeTestTestMutators =
  muirMoiraMutatorsAllMutators<MuirMoiraMutatorsBabelMutator>(
    muirProteusNodeTestTestMutatorSets,
  );
