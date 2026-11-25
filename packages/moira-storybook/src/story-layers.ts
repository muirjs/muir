import { withoutBinding, type Bindings } from './bindings.ts';
import { storyArgument, unwrap } from './csf-nodes.ts';
import { field } from './node-field.ts';
import { unknownValue } from './object-value.ts';

export interface ExtendLevel {
  /** The story's initializer at this level: a `.story()` or `.extend()` call, or a CSF3 story object. */
  readonly init: unknown;
  readonly argument: unknown;
  readonly owner: unknown;
  readonly bindings: Bindings;
}

export function extendLevels(
  init: unknown,
  owner: unknown,
  unchangedBindings: Bindings,
): readonly [ExtendLevel, ...(ExtendLevel | typeof unknownValue)[]] {
  const call = unwrap(init);
  const own = {
    init,
    argument: storyArgument(call),
    owner,
    bindings: unchangedBindings,
  };
  const base = field(call, 'callee', 'object', 'name');

  if (
    field(call, 'callee', 'property', 'name') !== 'extend' ||
    typeof base !== 'string'
  ) {
    return [own];
  }

  return unchangedBindings.has(base)
    ? [
        own,
        ...extendLevels(
          unchangedBindings.get(base),
          base,
          withoutBinding(unchangedBindings, base),
        ),
      ]
    : [own, unknownValue];
}
