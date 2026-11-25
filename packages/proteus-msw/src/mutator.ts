import type { NodePath, types } from '@babel/core';
import type { MuirMoiraMutatorsSampledMutator } from '@muirjs/moira-mutators';

// `as const` though Stryker leaves it unmutated (https://github.com/stryker-mutator/stryker-js/issues/6208): the compiler rejects a call to a member it lacks.
export const muirProteusMswBabelTypeMembers = [
  'arrayExpression',
  'callExpression',
  'cloneNode',
  'identifier',
  'memberExpression',
  'nullLiteral',
  'objectExpression',
  'stringLiteral',
] as const satisfies readonly (keyof typeof types)[];

export type MuirProteusMswBabelTypes = Pick<
  typeof types,
  (typeof muirProteusMswBabelTypeMembers)[number]
>;

export interface MuirProteusMswMutator extends MuirMoiraMutatorsSampledMutator {
  mutate(path: NodePath, t: MuirProteusMswBabelTypes): Iterable<types.Node>;
}
