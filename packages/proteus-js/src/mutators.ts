import {
  muirMoiraNodeTestAllMutators,
  type MuirMoiraNodeTestMutatorSets,
} from '@muirjs/moira-node-test';
import { muirProteusJsAssignmentStatement } from './js-assignment-statement.ts';
import { muirProteusJsNumericLiteral } from './js-numeric-literal.ts';

export const muirProteusJsMutatorSets = {
  defaults: [],
  optIn: [muirProteusJsNumericLiteral],
  experimental: [muirProteusJsAssignmentStatement],
} satisfies MuirMoiraNodeTestMutatorSets;

export const muirProteusJsMutators = muirMoiraNodeTestAllMutators(
  muirProteusJsMutatorSets,
);
