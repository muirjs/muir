import {
  propertyKeyValue,
  storyArgument,
  unwrap,
  withoutBinding,
} from './csf.ts';
import { isRecord } from './is-record.ts';
import { field, list } from './node-field.ts';

/** What one property, or one layer, of a story gives a key: `undefined` for nothing, `'unknown'` when something the file cannot read may set it, else the value node. */
export type LayerValue = object | 'unknown' | undefined;

/** The value of `key` that each of a story's layers sets, the story's own first. */
export function storyValues(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
  key: string,
): readonly LayerValue[] {
  return storyLayers(init, bindings).map((layer) => valuesIn(layer, key)[0]);
}

/** Every value that a property of the story's layers gives `key`, the one that runs first, then each it falls back to in turn. */
export function storyValueChain(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
  key: string,
): readonly LayerValue[] {
  return storyLayers(init, bindings).flatMap((layer) => valuesIn(layer, key));
}

/** The value of `key` the story's own object sets when it is the one that runs; `undefined` when a later property replaces it or a later spread that does not resolve may. */
export function ownStoryValue(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
  key: string,
): unknown {
  const [own = []] = storyLayers(init, bindings);
  const winner = own.find((property) => setsOrMay(property, key));

  return list(field(storyArgument(unwrap(init)), 'properties')).includes(winner)
    ? propertyKeyValue(winner, key)
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

/** The values the properties of a last-wins-first layer that set `key`, or as a spread that does not resolve may, give it. */
function valuesIn(
  layer: readonly unknown[],
  key: string,
): readonly LayerValue[] {
  return layer
    .filter((property) => setsOrMay(property, key))
    .map((property): LayerValue => {
      if (field(property, 'type') === 'SpreadElement') {
        return 'unknown';
      }

      const value = propertyKeyValue(property, key);

      return isRecord(value) ? value : undefined;
    });
}

function setsOrMay(property: unknown, key: string): boolean {
  return (
    field(property, 'type') === 'SpreadElement' ||
    propertyKeyValue(property, key) !== undefined
  );
}
