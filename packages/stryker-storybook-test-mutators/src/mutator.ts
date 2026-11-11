import type { NodePath, types } from '@babel/core';
import type { SampledMutator } from '@layzee/stryker-mutator-install';

// `as const` though Stryker leaves it unmutated (https://github.com/stryker-mutator/stryker-js/issues/6208): the compiler rejects a call to a member it lacks.
export const babelTypeMembers = [
  'arrowFunctionExpression',
  'awaitExpression',
  'blockStatement',
  'callExpression',
  'cloneNode',
  'emptyStatement',
  'expressionStatement',
  'identifier',
  'isNode',
  'isNodesEquivalent',
  'memberExpression',
] as const satisfies readonly (keyof typeof types)[];

export type BabelTypes = Pick<typeof types, (typeof babelTypeMembers)[number]>;

export interface LzStorybookTestMutator extends SampledMutator {
  mutate(path: NodePath, t: BabelTypes): Iterable<types.Node>;
}
