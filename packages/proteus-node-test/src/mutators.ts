import {
  muirMoiraNodeTestAllMutators,
  type MuirMoiraNodeTestMutatorSets,
} from '@muirjs/moira-node-test';
import { muirProteusNodeTestAssertCall } from './node-test-assert-call.ts';
import { muirProteusNodeTestAssertValidator } from './node-test-assert-validator.ts';
import { muirProteusNodeTestCatchAssert } from './node-test-catch-assert.ts';

export const muirProteusNodeTestTestMutatorSets = {
  defaults: [muirProteusNodeTestAssertCall, muirProteusNodeTestAssertValidator],
  optIn: [],
  experimental: [muirProteusNodeTestCatchAssert],
} satisfies MuirMoiraNodeTestMutatorSets;

export const muirProteusNodeTestTestMutators = muirMoiraNodeTestAllMutators(
  muirProteusNodeTestTestMutatorSets,
);
