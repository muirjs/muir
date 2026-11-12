import { storyArgument, unwrap } from './csf-nodes.ts';
import { withoutBinding } from './csf.ts';
import { field } from './node-field.ts';
import { unknownValue } from './object-value.ts';

type Bindings = ReadonlyMap<string, unknown>;

/** One level of a story's `.extend()` chain: the object it gives, the name that owns it, and the bindings it reads. */
export interface ExtendLevel {
  readonly argument: unknown;
  readonly owner: unknown;
  readonly bindings: Bindings;
}

/**
 * The levels a story ends up with, one for the story and then one for each `.extend()` base, as Storybook 10.6.5
 * `extend()` merges a base story in key by key. A base the bindings do not hold, imported or one the file changes, is
 * an unknown level.
 */
export function extendLevels(
  init: unknown,
  owner: unknown,
  bindings: Bindings,
): readonly [ExtendLevel, ...(ExtendLevel | typeof unknownValue)[]] {
  const call = unwrap(init);
  const own = { argument: storyArgument(call), owner, bindings };
  const base = field(call, 'callee', 'object', 'name');

  if (
    field(call, 'callee', 'property', 'name') !== 'extend' ||
    typeof base !== 'string'
  ) {
    return [own];
  }

  return bindings.has(base)
    ? [
        own,
        ...extendLevels(
          bindings.get(base),
          base,
          withoutBinding(bindings, base),
        ),
      ]
    : [own, unknownValue];
}
