import { isMember, keyOf, unwrap, withoutBinding } from './csf.ts';
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
      : shownObject(object, bindings)?.properties;

  return properties === undefined ? [unknownValue] : valuesIn(properties, key);
}

/** The value `object` gives `key` as JavaScript reads it, as `resolvedValues` reads the object. */
export function resolvedValue(
  object: unknown,
  key: string | number,
  bindings: Bindings,
): LayerValue {
  return resolvedValues(object, key, bindings)[0];
}

/** The value the last property of exactly `key` gives it, as `resolvedValues` reads `object`, past any spread or computed key the file does not resolve, which may or may not set it: the object a site is when nothing the file reads replaces it. */
export function ownValue(
  object: unknown,
  key: string | number,
  bindings: Bindings,
): LayerValue {
  if (object === undefined) {
    return undefined;
  }

  const properties =
    object === unknownValue
      ? undefined
      : shownObject(object, bindings)?.properties;

  return properties === undefined
    ? unknownValue
    : valuesIn(
        properties.filter((property) => propertyKey(property) === key),
        key,
      )[0];
}

/** An object that may set `key`, as `resolvedValues` reads it: one with a property that may, or one the file does not show; `undefined`, no object, sets nothing. */
export function maySetIn(
  object: unknown,
  key: string | number,
  bindings: Bindings,
): boolean {
  return resolvedValue(object, key, bindings) !== undefined;
}

/** Every value that `properties`, in source order, give `key`, the one JavaScript keeps first, each spread read as `resolvedValues` reads it. */
export function resolvedPropertyValues(
  properties: readonly unknown[],
  key: string | number,
  bindings: Bindings,
): readonly LayerValue[] {
  return valuesIn(lastWinsProperties(properties, bindings), key);
}

/**
 * An object literal the file shows, read through the bindings it was reached with. Only this module makes one, so
 * a node read straight from the file is never one: the `#` fields make the class nominal, and a literal with the same
 * members or a spread copy of one is not one.
 */
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

  /** Its properties last-wins first, each spread it resolves replaced by that object's properties. */
  get properties(): readonly unknown[] {
    return lastWinsProperties(
      list(field(this.#node, 'properties')),
      this.#bindings,
    );
  }

  /** The layer the object that `key` holds gives, such as a story's `args`. */
  layerOf(key: string | number): Layer {
    const value = valuesIn(this.properties, key)[0];

    return typeof value === 'object'
      ? (shownObject(value, this.#bindings) ?? unknownValue)
      : value;
  }
}

export type { ResolvedObject };

/** What one layer of a story's composition gives: an object the file shows and leaves unchanged, `unknownValue` for one it does not, or `undefined` for none. */
export type Layer = ResolvedObject | typeof unknownValue | undefined;

/** The layer a root object gives: a meta object, a story's own object or `.test()` options, read through `unchanged`. A root whose `owner`, the family name a write to it marks, is in `written` gives `unknownValue`; no expression gives none. */
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

/** The layer the object that `key` holds in `layer` gives. */
export function layerOf(layer: Layer, key: string | number): Layer {
  return typeof layer === 'object' ? layer.layerOf(key) : layer;
}

/** Every value `layer` gives `key`, the one JavaScript keeps first: none for no layer, one `unknownValue` for an unknown one. */
export function valuesOf(
  layer: Layer,
  key: string | number,
): readonly LayerValue[] {
  if (layer === undefined) {
    return [];
  }

  return layer === unknownValue
    ? [unknownValue]
    : valuesIn(layer.properties, key);
}

/** The object literal `node` evaluates to; `undefined` when the file does not show one. */
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
      : valuesIn(object.properties, key)[0];

  // Without the member's root name, a value that names the member again, as in `const A = { b: A.b }`, ends.
  return isRecord(value)
    ? shownObject(value, withoutBinding(bindings, rootName(current)))
    : undefined;
}

/** `properties` last-wins first, each spread of an object `resolvedValues` reads replaced by that object's properties; a spread it does not read stays in place, for `valuesIn` to read as one that may set any key. */
export function lastWinsProperties(
  properties: readonly unknown[],
  bindings: Bindings,
): readonly unknown[] {
  return properties
    .toReversed()
    .flatMap(
      (property) =>
        (field(property, 'type') === 'SpreadElement'
          ? shownObject(field(property, 'argument'), bindings)?.properties
          : undefined) ?? [property],
    );
}

function rootName(node: unknown): unknown {
  return isMember(node)
    ? rootName(field(node, 'object'))
    : field(unwrap(node), 'name');
}
