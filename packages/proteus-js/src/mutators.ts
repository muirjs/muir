import {
  muirMoiraMutatorsAllMutators,
  type MuirMoiraMutatorsBabelMutator,
  type MuirMoiraMutatorsMutatorSets,
} from '@muirjs/moira-mutators';
import { muirProteusJsAssignmentStatement } from './js-assignment-statement.ts';
import { muirProteusJsNumericLiteral } from './js-numeric-literal.ts';

export const muirProteusJsMutatorSets = {
  defaults: [],
  optIn: [muirProteusJsNumericLiteral],
  experimental: [muirProteusJsAssignmentStatement],
} satisfies MuirMoiraMutatorsMutatorSets<MuirMoiraMutatorsBabelMutator>;

export const muirProteusJsMutators =
  muirMoiraMutatorsAllMutators<MuirMoiraMutatorsBabelMutator>(
    muirProteusJsMutatorSets,
  );
