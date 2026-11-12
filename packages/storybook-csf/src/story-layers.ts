import { storyArgument, unwrap, withoutBinding } from './csf.ts';
import { field } from './node-field.ts';
import { unknownValue, type LayerValue } from './object-value.ts';
import {
  literalLayer,
  rootLayer,
  valuesOf,
  type Layer,
} from './resolved-values.ts';

type Bindings = ReadonlyMap<string, unknown>;

/**
 * How `storyRoots` reads the object of each layer: `'root'` through `rootLayer`, so a written owner, or an object the
 * file does not show, gives an unknown layer; `'as-written'` as the object literal the file writes, whatever it
 * writes to the owner later, and no layer for any other expression. The play chain reads `'as-written'`, as
 * `playedStories` takes a play assigned later from the writes itself, and a write to a story's `args` leaves its play
 * as it is.
 */
export type LayerReading = 'root' | 'as-written';

/**
 * The layers a story ends up with, one each for the story and then each `.extend()` base, as Storybook 10.6.5
 * `extend()` merges a base story in key by key. A base the bindings do not hold, imported or one the file changes, is
 * an unknown layer.
 */
export function storyRoots(
  init: unknown,
  owner: unknown,
  written: ReadonlySet<unknown>,
  unchanged: Bindings,
  reading: LayerReading,
): readonly [Layer, ...Layer[]] {
  const call = unwrap(init);
  const own =
    reading === 'root'
      ? rootLayer(storyArgument(call), owner, written, unchanged)
      : literalLayer(storyArgument(call), unchanged);
  const base = field(call, 'callee', 'object', 'name');

  if (
    field(call, 'callee', 'property', 'name') !== 'extend' ||
    typeof base !== 'string'
  ) {
    return [own];
  }

  return unchanged.has(base)
    ? [
        own,
        ...storyRoots(
          unchanged.get(base),
          base,
          written,
          withoutBinding(unchanged, base),
          reading,
        ),
      ]
    : [own, unknownValue];
}

/** Every value that a property of the story's layers gives `key`, the one that runs first, then each it falls back to in turn. */
export function storyValueChain(
  layers: readonly Layer[],
  key: string,
): readonly LayerValue[] {
  return layers.flatMap((layer) => valuesOf(layer, key));
}
