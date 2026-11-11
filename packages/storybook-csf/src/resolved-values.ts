import { isMember, keyOf, unwrap, withoutBinding } from './csf.ts';
import { isRecord } from './is-record.ts';
import { field, list } from './node-field.ts';
import { unknownValue, valuesIn, type LayerValue } from './object-value.ts';

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
    object === unknownValue ? undefined : propertiesOf(object, bindings);

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

/** Every value that `properties`, in source order, give `key`, the one JavaScript keeps first, each spread read as `resolvedValues` reads it. */
export function resolvedPropertyValues(
  properties: readonly unknown[],
  key: string | number,
  bindings: Bindings,
): readonly LayerValue[] {
  return valuesIn(lastWinsProperties(properties, bindings), key);
}

/** The properties of the object literal `node` evaluates to, last-wins first; `undefined` when the file does not show one. */
function propertiesOf(
  node: unknown,
  bindings: Bindings,
): readonly unknown[] | undefined {
  const current = unwrap(node);
  const name = field(current, 'name');

  if (field(current, 'type') === 'ObjectExpression') {
    return lastWinsProperties(list(field(current, 'properties')), bindings);
  }

  if (field(current, 'type') === 'Identifier' && typeof name === 'string') {
    return bindings.has(name)
      ? propertiesOf(bindings.get(name), withoutBinding(bindings, name))
      : undefined;
  }

  const key = keyOf(current);
  const object = isMember(current)
    ? propertiesOf(field(current, 'object'), bindings)
    : undefined;
  const value =
    object === undefined || typeof key !== 'string'
      ? undefined
      : valuesIn(object, key)[0];

  // Without the member's root name, a value that names the member again, as in `const A = { b: A.b }`, ends.
  return isRecord(value)
    ? propertiesOf(value, withoutBinding(bindings, rootName(current)))
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
          ? propertiesOf(field(property, 'argument'), bindings)
          : undefined) ?? [property],
    );
}

function rootName(node: unknown): unknown {
  return isMember(node)
    ? rootName(field(node, 'object'))
    : field(unwrap(node), 'name');
}
