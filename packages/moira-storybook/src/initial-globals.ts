import { field, list } from './node-field.ts';
import {
  isObjectLiteral,
  objectValue,
  propertyKey,
  type LayerValue,
} from './object-value.ts';
import { valuesOf, type Layer } from './resolved-values.ts';

// Storybook 10.6.5's own initial globals (`initialGlobals` of its viewport, backgrounds, measure and outline addons,
// and its `DEFAULT_VIEWPORT` name). A project's preview `initialGlobals` can differ; the file does not show them.
const viewportDefaults: readonly unknown[] = ['responsive', '100pct-100pct'];

const defaultBackgrounds: ReadonlyMap<string, readonly unknown[]> = new Map([
  ['value', [undefined]],
  ['grid', [false]],
]);

const initialGlobals: ReadonlyMap<
  string,
  (value: unknown, parameters: readonly Layer[]) => boolean
> = new Map([
  [
    // The Vitest addon's `setViewport` uses a viewport global's `value`, else `parameters.viewport.defaultViewport`,
    // so a viewport is no default where a `parameters` layer of the site's runs may set `viewport`.
    'viewport',
    (value: unknown, parameters: readonly Layer[]) =>
      parameters.every(
        (layer) => valuesOf(layer, 'viewport')[0] === undefined,
      ) &&
      (viewportDefaults.includes(stringBooleanOrUndefinedOf(value)) ||
        (isObjectLiteral(value) &&
          isDefaultViewportValue(objectValue(value, 'value')))),
  ],
  [
    'backgrounds',
    (value: unknown) => isObjectOfAllowedLiterals(value, defaultBackgrounds),
  ],
  ['measureEnabled', isFalse],
  ['outline', isFalse],
]);

export function isInitialGlobal(
  key: string,
  value: unknown,
  parameters: readonly Layer[],
): boolean {
  return initialGlobals.get(key)?.(value, parameters) === true;
}

function isFalse(value: unknown): boolean {
  return stringBooleanOrUndefinedOf(value) === false;
}

function isObjectOfAllowedLiterals(
  value: unknown,
  allowed: ReadonlyMap<string, readonly unknown[]>,
): boolean {
  return (
    isObjectLiteral(value) &&
    list(value['properties']).every((property) => {
      const key = propertyKey(property);

      return (
        typeof key === 'string' &&
        allowed
          .get(key)
          ?.includes(stringBooleanOrUndefinedOf(field(property, 'value'))) ===
          true
      );
    })
  );
}

function isDefaultViewportValue(value: LayerValue): boolean {
  return (
    value === undefined ||
    [undefined, ...viewportDefaults].includes(stringBooleanOrUndefinedOf(value))
  );
}

const notALiteral = Symbol('not a literal');

function stringBooleanOrUndefinedOf(node: unknown): unknown {
  if (field(node, 'type') === 'Identifier') {
    return field(node, 'name') === 'undefined' ? undefined : notALiteral;
  }

  const type = field(node, 'type');

  return type === 'StringLiteral' || type === 'BooleanLiteral'
    ? field(node, 'value')
    : notALiteral;
}
