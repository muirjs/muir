import { storyArgument, unwrap, withoutBinding } from './csf.ts';
import { field, list } from './node-field.ts';
import {
  maySet,
  unknownValue,
  valuesIn,
  type LayerValue,
} from './object-value.ts';
import { lastWinsProperties } from './resolved-values.ts';

/** A layer's properties last-wins first, or `unknownValue` for an `.extend()` base the file does not bind. */
type Layer = readonly unknown[] | typeof unknownValue;

/** The value of `key` that each of a story's layers sets, the story's own first. */
export function storyValues(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
  key: string,
): readonly LayerValue[] {
  return storyLayers(init, bindings).map((layer) => layerValues(layer, key)[0]);
}

function layerValues(layer: Layer, key: string): readonly LayerValue[] {
  return layer === unknownValue ? [unknownValue] : valuesIn(layer, key);
}

/** Every value that a property of the story's layers gives `key`, the one that runs first, then each it falls back to in turn. */
export function storyValueChain(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
  key: string,
): readonly LayerValue[] {
  return storyLayers(init, bindings).flatMap((layer) =>
    layerValues(layer, key),
  );
}

/** The value of `key` the story's own object sets when it is the one that runs: `unknownValue` when an own spread or computed key that does not resolve may set it last, `undefined` when a property of another object replaces it or none sets it. */
export function ownStoryValue(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
  key: string,
): LayerValue {
  const [own] = storyLayers(init, bindings);
  const winner = own.find((property) => maySet(property, key));

  return list(field(storyArgument(unwrap(init)), 'properties')).includes(winner)
    ? valuesIn([winner], key)[0]
    : undefined;
}

/**
 * The properties a story ends up with, one layer each for the story and then each `.extend()` base, as Storybook
 * 10.6.5 `extend()` merges a base story in key by key. Each layer lists its properties last-wins first, with the
 * properties of an object it spreads that `resolvedValues` reads in place of the spread, as object spread replaces a
 * key whole. A base
 * the bindings do not hold, imported or one the file changes, is an unknown layer.
 */
function storyLayers(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
): readonly [readonly unknown[], ...Layer[]] {
  const call = unwrap(init);
  const own = lastWinsProperties(
    list(field(storyArgument(call), 'properties')),
    bindings,
  );
  const base = field(call, 'callee', 'object', 'name');

  if (
    field(call, 'callee', 'property', 'name') !== 'extend' ||
    typeof base !== 'string'
  ) {
    return [own];
  }

  return bindings.has(base)
    ? [own, ...storyLayers(bindings.get(base), withoutBinding(bindings, base))]
    : [own, unknownValue];
}
