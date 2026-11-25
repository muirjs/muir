import {
  muirMoiraStorybookWithoutBinding,
  type MuirMoiraStorybookBindings,
} from './bindings.ts';
import {
  muirMoiraStorybookStoryArgument,
  muirMoiraStorybookUnwrap,
} from './csf-nodes.ts';
import { muirMoiraStorybookField } from './node-field.ts';
import { muirMoiraStorybookUnknownValue } from './object-value.ts';

export interface MuirMoiraStorybookExtendLevel {
  /** The story's initializer at this level: a `.story()` or `.extend()` call, or a CSF3 story object. */
  readonly init: unknown;
  readonly argument: unknown;
  readonly owner: unknown;
  readonly bindings: MuirMoiraStorybookBindings;
}

export function muirMoiraStorybookExtendLevels(
  init: unknown,
  owner: unknown,
  unchangedBindings: MuirMoiraStorybookBindings,
): readonly [
  MuirMoiraStorybookExtendLevel,
  ...(MuirMoiraStorybookExtendLevel | typeof muirMoiraStorybookUnknownValue)[],
] {
  const call = muirMoiraStorybookUnwrap(init);
  const own = {
    init,
    argument: muirMoiraStorybookStoryArgument(call),
    owner,
    bindings: unchangedBindings,
  };
  const base = muirMoiraStorybookField(call, 'callee', 'object', 'name');

  if (
    muirMoiraStorybookField(call, 'callee', 'property', 'name') !== 'extend' ||
    typeof base !== 'string'
  ) {
    return [own];
  }

  return unchangedBindings.has(base)
    ? [
        own,
        ...muirMoiraStorybookExtendLevels(
          unchangedBindings.get(base),
          base,
          muirMoiraStorybookWithoutBinding(unchangedBindings, base),
        ),
      ]
    : [own, muirMoiraStorybookUnknownValue];
}
