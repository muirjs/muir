import { propertyValue, storyArgument, unwrap, withoutBinding } from './csf.ts';
import { field, list } from './node-field.ts';

/**
 * The value of `key` that each of a story's layers sets, the story's own first; `undefined` for a layer that sets
 * none, and the spread itself for a layer where a spread that does not resolve may set it last, as only running the
 * file tells what that spread sets.
 */
export function storyValues(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
  key: string,
): readonly unknown[] {
  return storyLayers(init, bindings).map((layer) => {
    const winner = winningProperty(layer, key);

    return field(winner, 'type') === 'SpreadElement'
      ? winner
      : propertyValue({ properties: [winner] }, key);
  });
}

/** The value of `key` the story's own object sets when it is the one that runs; `undefined` when a later property replaces it or a later spread that does not resolve may. */
export function ownStoryValue(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
  key: string,
): unknown {
  const [own = []] = storyLayers(init, bindings);
  const winner = winningProperty(own, key);

  return list(field(storyArgument(unwrap(init)), 'properties')).includes(winner)
    ? propertyValue({ properties: [winner] }, key)
    : undefined;
}

/**
 * `properties` last-wins first, each spread whose argument `spreadObject` resolves to an object literal replaced by
 * that object's properties, read the same way without the binding the spread names, so a cycle of spreads ends. A
 * spread it does not resolve stays in its place, for the caller to read as one that may set any key.
 */
export function lastWinsProperties(
  properties: readonly unknown[],
  bindings: ReadonlyMap<string, unknown>,
  spreadObject: (
    argument: unknown,
    bindings: ReadonlyMap<string, unknown>,
  ) => unknown,
): readonly unknown[] {
  return properties.toReversed().flatMap((property) => {
    const argument = field(property, 'argument');
    const spread =
      field(property, 'type') === 'SpreadElement'
        ? spreadObject(argument, bindings)
        : undefined;

    return field(spread, 'type') === 'ObjectExpression'
      ? lastWinsProperties(
          list(field(spread, 'properties')),
          withoutBinding(
            bindings,
            field(argument, 'name') ?? field(argument, 'object', 'name'),
          ),
          spreadObject,
        )
      : [property];
  });
}

/**
 * The properties a story ends up with, one layer each for the story and then each `.extend()` base, as Storybook
 * 10.6.5 `extend()` merges a base story in key by key. Each layer lists its properties last-wins first, with the
 * properties of a top-level object it spreads in place of the spread, as object spread replaces a key whole.
 */
function storyLayers(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
): readonly (readonly unknown[])[] {
  const call = unwrap(init);
  const own = lastWinsProperties(
    list(field(storyArgument(call), 'properties')),
    bindings,
    (argument, inner) => {
      const name = field(argument, 'name');

      return typeof name === 'string' ? unwrap(inner.get(name)) : undefined;
    },
  );
  const base = field(call, 'callee', 'object', 'name');

  return field(call, 'callee', 'property', 'name') === 'extend' &&
    typeof base === 'string'
    ? [own, ...storyLayers(bindings.get(base), withoutBinding(bindings, base))]
    : [own];
}

/** The first property of a last-wins-first layer that sets `key` or, as a spread that does not resolve, may. */
function winningProperty(layer: readonly unknown[], key: string): unknown {
  return layer.find(
    (property) =>
      field(property, 'type') === 'SpreadElement' ||
      propertyValue({ properties: [property] }, key) !== undefined,
  );
}
