import { withoutBinding, type Bindings } from './bindings.ts';
import { isMember, keyOf, memberRoot, unwrap } from './csf-nodes.ts';
import { isRecord } from './is-record.ts';
import { field, list } from './node-field.ts';
import {
  isObjectLiteral,
  propertyKey,
  unknownValue,
  valuesIn,
  type LayerValue,
  type ObjectLiteral,
} from './object-value.ts';

/** The value the last property of exactly `key` gives it, as `shownObject` reads `object`, past any spread or computed key the file does not resolve, which may or may not set it: the object a site is when nothing the file reads replaces it. `undefined` for an object the file does not show, which is no site. */
export function ownValue(
  object: unknown,
  key: string,
  bindings: Bindings,
): LayerValue {
  return ownValueOf(shownObject(object, bindings), key);
}

export function ownValueOf(layer: Layer, key: string): LayerValue {
  return typeof layer === 'object'
    ? valuesIn(
        layer.lastWinsProperties.filter(
          (property) => propertyKey(property) === key,
        ),
        key,
      )[0]
    : layer;
}

/** Every value that `properties`, in source order, give `key`, the one JavaScript keeps first, each spread read as `shownObject` reads it. */
export function resolvedPropertyValues(
  properties: readonly unknown[],
  key: string | number,
  bindings: Bindings,
): readonly LayerValue[] {
  return valuesIn(inLastWinsOrder(properties, bindings), key);
}

class ResolvedObject {
  readonly #node: ObjectLiteral;
  readonly #bindings: Bindings;

  constructor(node: ObjectLiteral, bindings: Bindings) {
    this.#node = node;
    this.#bindings = bindings;
  }

  get node(): ObjectLiteral {
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

export function asWrittenLayer(expression: unknown, bindings: Bindings): Layer {
  return isObjectLiteral(expression)
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

/**
 * The object literal `node` shows, read through `as const`, `satisfies` and parentheses, a name `bindings` holds,
 * and a member with a static key such as `Base.args`; `undefined` for one the file does not show. Given
 * `unchangedBindings`, a name the file may change reads as one it does not show.
 */
function shownObject(
  node: unknown,
  bindings: Bindings,
): ResolvedObject | undefined {
  const current = unwrap(node);
  const name = field(current, 'name');

  if (isObjectLiteral(current)) {
    return new ResolvedObject(current, bindings);
  }

  if (typeof name === 'string') {
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

/** `properties` last-wins first, each spread of an object `shownObject` reads replaced by that object's properties; a spread it does not read stays in place, for `valuesIn` to read as one that may set any key. */
function inLastWinsOrder(
  properties: readonly unknown[],
  bindings: Bindings,
): readonly unknown[] {
  return properties
    .toReversed()
    .flatMap(
      (property) =>
        shownObject(field(property, 'argument'), bindings)
          ?.lastWinsProperties ?? [property],
    );
}
