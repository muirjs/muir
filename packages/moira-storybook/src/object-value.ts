import { muirMoiraStorybookIsRecord } from './is-record.ts';
import {
  muirMoiraStorybookField,
  muirMoiraStorybookList,
} from './node-field.ts';

/** What something the file cannot read gives a key: a spread of an imported object, a computed key, or a value that is not an object literal. */
export const muirMoiraStorybookUnknownValue = 'unknown';

export interface MuirMoiraStorybookObjectLiteral {
  readonly type: 'ObjectExpression';
  readonly [key: string]: unknown;
}

export function muirMoiraStorybookIsObjectLiteral(
  node: unknown,
): node is MuirMoiraStorybookObjectLiteral {
  return (
    muirMoiraStorybookIsRecord(node) && node['type'] === 'ObjectExpression'
  );
}

/** What one property, one object or one layer of a story gives a key: `undefined` for nothing, `unknownValue` when something the file cannot read may set it, else the value node. */
export type MuirMoiraStorybookLayerValue =
  | object
  | typeof muirMoiraStorybookUnknownValue
  | undefined;

/** The key of `label: ...`, `'label': ...` or `0: ...`; `undefined` for a computed key or a spread, which only running the file resolves. */
export function muirMoiraStorybookPropertyKey(
  property: unknown,
): string | number | undefined {
  if (muirMoiraStorybookField(property, 'computed') === true) {
    return undefined;
  }

  const name =
    muirMoiraStorybookField(property, 'key', 'name') ??
    muirMoiraStorybookField(property, 'key', 'value');

  return typeof name === 'string' || typeof name === 'number'
    ? name
    : undefined;
}

/** A property that may set `key`: one of that key, or a spread or computed key, which only running the file resolves. */
export function muirMoiraStorybookMaySet(
  property: unknown,
  key: string | number,
): boolean {
  const name = muirMoiraStorybookPropertyKey(property);

  return name === undefined || String(name) === String(key);
}

/** The values the properties of a last-wins-first list that may set `key` give it: `unknownValue` for a spread or a computed key, a method being its own value. */
export function muirMoiraStorybookValuesIn(
  properties: readonly unknown[],
  key: string | number,
): readonly MuirMoiraStorybookLayerValue[] {
  return properties
    .filter((property) => muirMoiraStorybookMaySet(property, key))
    .map(
      (property): MuirMoiraStorybookLayerValue =>
        muirMoiraStorybookPropertyKey(property) === undefined
          ? muirMoiraStorybookUnknownValue
          : propertyValue(property),
    );
}

/** The value node of a property, a method being its own value; `undefined` for none. */
function propertyValue(property: unknown): object | undefined {
  const value =
    muirMoiraStorybookField(property, 'type') === 'ObjectMethod'
      ? property
      : muirMoiraStorybookField(property, 'value');

  return muirMoiraStorybookIsRecord(value) ? value : undefined;
}

/** The value node the file writes for `key` in an object literal, as Storybook 10.6.5 CsfFile reads a meta or story property: the last property whose key is the identifier `key`, computed or not (`t.isIdentifier(p.key)`; of the key nodes, only an identifier has a `name`), so a string-literal key gives none, whether or not a later spread or computed key may replace it when the file runs. It tells what role a node has, such as test code or a tag list, not which value runs; `valuesOf` reads that, with JavaScript's keys. */
export function muirMoiraStorybookWrittenValue(
  object: unknown,
  key: string,
): object | undefined {
  return propertyValue(
    muirMoiraStorybookList(
      muirMoiraStorybookField(object, 'properties'),
    ).findLast(
      (candidate) => muirMoiraStorybookField(candidate, 'key', 'name') === key,
    ),
  );
}

/** The value the object literal `object` gives `key` as JavaScript reads it, the last property that may set it winning. */
export function muirMoiraStorybookObjectValue(
  object: MuirMoiraStorybookObjectLiteral,
  key: string | number,
): MuirMoiraStorybookLayerValue {
  return muirMoiraStorybookValuesIn(
    muirMoiraStorybookList(object['properties']).toReversed(),
    key,
  )[0];
}
