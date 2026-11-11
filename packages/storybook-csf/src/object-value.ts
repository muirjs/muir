import { isRecord } from './is-record.ts';
import { field, list } from './node-field.ts';

/** What something the file cannot read gives a key: a spread of an imported object, a computed key, or a value that is no object literal. */
export const unknownValue = 'unknown';

/** What one property, one object or one layer of a story gives a key: `undefined` for nothing, `unknownValue` when something the file cannot read may set it, else the value node. */
export type LayerValue = object | typeof unknownValue | undefined;

/** The key of `label: ...`, `'label': ...` or `0: ...`; `undefined` for a computed key or a spread, which only running the file resolves. */
export function propertyKey(property: unknown): string | number | undefined {
  if (field(property, 'computed') === true) {
    return undefined;
  }

  const name =
    field(property, 'key', 'name') ?? field(property, 'key', 'value');

  return typeof name === 'string' || typeof name === 'number'
    ? name
    : undefined;
}

/** A property that may set `key`: one of that key, or a spread or computed key, which only running the file resolves. */
export function maySet(property: unknown, key: string | number): boolean {
  const name = propertyKey(property);

  return name === undefined || name === key;
}

/** The values the properties of a last-wins-first list that may set `key` give it: `unknownValue` for a spread or a computed key, a method being its own value. */
export function valuesIn(
  properties: readonly unknown[],
  key: string | number,
): readonly LayerValue[] {
  return properties
    .filter((property) => maySet(property, key))
    .map((property): LayerValue => {
      if (propertyKey(property) !== key) {
        return unknownValue;
      }

      const value =
        field(property, 'type') === 'ObjectMethod'
          ? property
          : field(property, 'value');

      return isRecord(value) ? value : undefined;
    });
}

/** Every value a property of `object` gives `key`, the one JavaScript keeps first; none for no object, and one `unknownValue` for a value that is no object literal. */
export function objectValues(
  object: unknown,
  key: string | number,
): readonly LayerValue[] {
  if (object === undefined) {
    return [];
  }

  if (object === unknownValue || field(object, 'type') !== 'ObjectExpression') {
    return [unknownValue];
  }

  return valuesIn(list(field(object, 'properties')).toReversed(), key);
}

/** The value `object` gives `key` as JavaScript reads it, the last property that may set it winning. */
export function objectValue(object: unknown, key: string | number): LayerValue {
  return objectValues(object, key)[0];
}

/** An object that may set `key`: an object literal with a property that may, or anything the file cannot read. */
export function maySetIn(object: unknown, key: string | number): boolean {
  return objectValue(object, key) !== undefined;
}
