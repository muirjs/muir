import type { NodePath, types } from '@babel/core';
import type { MuirMoiraMutatorsSampledMutator } from '@muirjs/moira-mutators';

// `as const` though Stryker leaves it unmutated (https://github.com/stryker-mutator/stryker-js/issues/6208): the compiler rejects a call to a member it lacks.
export const muirProteusStorybookBabelTypeMembers = [
  'cloneNode',
  'objectExpression',
] as const satisfies readonly (keyof typeof types)[];

export type MuirProteusStorybookBabelTypes = Pick<
  typeof types,
  (typeof muirProteusStorybookBabelTypeMembers)[number]
>;

export interface MuirProteusStorybookMutator
  extends MuirMoiraMutatorsSampledMutator {
  mutate(
    path: NodePath,
    t: MuirProteusStorybookBabelTypes,
  ): Iterable<types.Node>;
}
