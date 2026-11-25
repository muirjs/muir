import type { NodePath, types } from '@babel/core';
import type { MuirMoiraMutatorsSampledMutator } from '@muirjs/moira-mutators';

// `as const` though Stryker leaves it unmutated (https://github.com/stryker-mutator/stryker-js/issues/6208): the compiler rejects a call to a member it lacks.
export const muirProteusStorybookTestBabelTypeMembers = [
  'arrowFunctionExpression',
  'awaitExpression',
  'blockStatement',
  'callExpression',
  'cloneNode',
  'emptyStatement',
  'expressionStatement',
  'identifier',
  'isNode',
  'isStatement',
  'memberExpression',
  'newExpression',
  'objectExpression',
  'sequenceExpression',
  'stringLiteral',
] as const satisfies readonly (keyof typeof types)[];

export type MuirProteusStorybookTestBabelTypes = Pick<
  typeof types,
  (typeof muirProteusStorybookTestBabelTypeMembers)[number]
>;

export interface MuirProteusStorybookTestMutator
  extends MuirMoiraMutatorsSampledMutator {
  mutate(
    path: NodePath,
    t: MuirProteusStorybookTestBabelTypes,
  ): Iterable<types.Node>;
}
