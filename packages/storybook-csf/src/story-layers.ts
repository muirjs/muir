import { storyArgument, unwrap } from './csf-nodes.ts';
import { withoutBinding } from './csf.ts';
import { field } from './node-field.ts';
import { unknownValue, type LayerValue } from './object-value.ts';
import {
  literalLayer,
  rootLayer,
  valuesOf,
  type Layer,
} from './resolved-values.ts';

type Bindings = ReadonlyMap<string, unknown>;

type LayerReading = 'root' | 'as-written';

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

export function storyValueChain(
  layers: readonly Layer[],
  key: string,
): readonly LayerValue[] {
  return layers.flatMap((layer) => valuesOf(layer, key));
}
