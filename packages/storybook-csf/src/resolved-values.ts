import { isMember, keyOf, memberRoot, unwrap } from './csf-nodes.ts';
import { withoutBinding } from './csf.ts';
import { isRecord } from './is-record.ts';
import { field, list } from './node-field.ts';
import {
  propertyKey,
  unknownValue,
  valuesIn,
  type LayerValue,
} from './object-value.ts';

type Bindings = ReadonlyMap<string, unknown>;

/**
 * Every value `object` gives `key`, the one JavaScript keeps first, as far as the file shows it: an object literal,
 * read through `as const`, `satisfies` and parentheses, a name `bindings` holds, a member with a static key such as
 * `Base.args`, and a spread of any of these. None for no object; one `unknownValue` for an object the file does not
 * show. Given `unchangedBindings`, a name the file may change reads as one it does not show.
 */
export function resolvedValues(
  object: unknown,
  key: string | number,
  bindings: Bindings,
): readonly LayerValue[] {
  if (object === undefined) {
    return [];
  }

  const properties =
    object === unknownValue
      ? undefined
      : shownObject(object, bindings)?.lastWinsProperties;

  return properties === undefined ? [unknownValue] : valuesIn(properties, key);
}

/** The value the last property of exactly `key` gives it, as `resolvedValues` reads `object`, past any spread or computed key the file does not resolve, which may or may not set it: the object a site is when nothing the file reads replaces it. */
export function ownValue(
  object: unknown,
  key: string | number,
  bindings: Bindings,
): LayerValue {
  return ownValueOf(
    object === undefined || object === unknownValue
      ? object
      : (shownObject(object, bindings) ?? unknownValue),
    key,
  );
}

/** The value the last property of exactly `key` gives it in `layer`, as `ownValue` reads an object. */
export function ownValueOf(layer: Layer, key: string | number): LayerValue {
  return typeof layer === 'object'
    ? valuesIn(
        layer.lastWinsProperties.filter(
          (property) => propertyKey(property) === key,
        ),
        key,
      )[0]
    : layer;
}

/** Every value that `properties`, in source order, give `key`, the one JavaScript keeps first, each spread read as `resolvedValues` reads it. */
export function resolvedPropertyValues(
  properties: readonly unknown[],
  key: string | number,
  bindings: Bindings,
): readonly LayerValue[] {
  return valuesIn(inLastWinsOrder(properties, bindings), key);
}

class ResolvedObject {
  readonly #node: object;
  readonly #bindings: Bindings;

  constructor(node: object, bindings: Bindings) {
    this.#node = node;
    this.#bindings = bindings;
  }

  get node(): object {
    return this.#node;
  }

  get lastWinsProperties(): readonly unknown[] {
    return inLastWinsOrder(
      list(field(this.#node, 'properties')),
      this.#bindings,
    );
  }

  layerOf(key: string | number): Layer {
    const value = valuesIn(this.lastWinsProperties, key)[0];

    return typeof value === 'object'
      ? (shownObject(value, this.#bindings) ?? unknownValue)
      : value;
  }
}

export type { ResolvedObject };

export type Layer = ResolvedObject | typeof unknownValue | undefined;

export function rootLayer(
  expression: unknown,
  owner: unknown,
  written: ReadonlySet<unknown>,
  unchanged: Bindings,
): Layer {
  if (expression === undefined) {
    return undefined;
  }

  return written.has(owner)
    ? unknownValue
    : (shownObject(expression, unchanged) ?? unknownValue);
}

/** `expression` when it is an object literal, read as the file writes it whatever the file writes to its owner later; no layer for any other expression. */
export function literalLayer(expression: unknown, bindings: Bindings): Layer {
  return isRecord(expression) && expression['type'] === 'ObjectExpression'
    ? new ResolvedObject(expression, bindings)
    : undefined;
}

export function layerOf(layer: Layer, key: string | number): Layer {
  return typeof layer === 'object' ? layer.layerOf(key) : layer;
}

export function valuesOf(
  layer: Layer,
  key: string | number,
): readonly LayerValue[] {
  if (layer === undefined) {
    return [];
  }

  return layer === unknownValue
    ? [unknownValue]
    : valuesIn(layer.lastWinsProperties, key);
}

function shownObject(
  node: unknown,
  bindings: Bindings,
): ResolvedObject | undefined {
  const current = unwrap(node);
  const name = field(current, 'name');

  if (isRecord(current) && current['type'] === 'ObjectExpression') {
    return new ResolvedObject(current, bindings);
  }

  if (field(current, 'type') === 'Identifier' && typeof name === 'string') {
    return bindings.has(name)
      ? shownObject(bindings.get(name), withoutBinding(bindings, name))
      : undefined;
  }

  const key = keyOf(current);
  const object = isMember(current)
    ? shownObject(field(current, 'object'), bindings)
    : undefined;
  const value =
    object === undefined || typeof key !== 'string'
      ? undefined
      : valuesIn(object.lastWinsProperties, key)[0];

  // Without the member's root name, a value that names the member again, as in `const A = { b: A.b }`, ends.
  return isRecord(value)
    ? shownObject(
        value,
        withoutBinding(bindings, field(memberRoot(current), 'name')),
      )
    : undefined;
}

/** `properties` last-wins first, each spread of an object `resolvedValues` reads replaced by that object's properties; a spread it does not read stays in place, for `valuesIn` to read as one that may set any key. */
function inLastWinsOrder(
  properties: readonly unknown[],
  bindings: Bindings,
): readonly unknown[] {
  return properties
    .toReversed()
    .flatMap(
      (property) =>
        (field(property, 'type') === 'SpreadElement'
          ? shownObject(field(property, 'argument'), bindings)
              ?.lastWinsProperties
          : undefined) ?? [property],
    );
}
