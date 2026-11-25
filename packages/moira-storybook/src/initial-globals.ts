import {
  muirMoiraStorybookField,
  muirMoiraStorybookList,
} from './node-field.ts';
import {
  muirMoiraStorybookIsObjectLiteral,
  muirMoiraStorybookObjectValue,
  muirMoiraStorybookPropertyKey,
  type MuirMoiraStorybookLayerValue,
} from './object-value.ts';
import {
  muirMoiraStorybookValuesOf,
  type MuirMoiraStorybookLayer,
} from './resolved-values.ts';

// Storybook 10.6.5's own initial globals (`initialGlobals` of its viewport, backgrounds, measure and outline addons,
// and its `DEFAULT_VIEWPORT` name). A project's preview `initialGlobals` can differ; the file does not show them.
const viewportDefaults: readonly unknown[] = ['responsive', '100pct-100pct'];

const defaultBackgrounds: ReadonlyMap<string, readonly unknown[]> = new Map([
  ['value', [undefined]],
  ['grid', [false]],
]);

const initialGlobals: ReadonlyMap<
  string,
  (value: unknown, parameters: readonly MuirMoiraStorybookLayer[]) => boolean
> = new Map([
  [
    // The Vitest addon's `setViewport` uses a viewport global's `value`, else `parameters.viewport.defaultViewport`,
    // so a viewport is no default where a `parameters` layer of the site's runs may set `viewport`.
    'viewport',
    (value: unknown, parameters: readonly MuirMoiraStorybookLayer[]) =>
      parameters.every(
        (layer) =>
          muirMoiraStorybookValuesOf(layer, 'viewport')[0] === undefined,
      ) &&
      (viewportDefaults.includes(stringBooleanOrUndefinedOf(value)) ||
        (muirMoiraStorybookIsObjectLiteral(value) &&
          isDefaultViewportValue(
            muirMoiraStorybookObjectValue(value, 'value'),
          ))),
  ],
  [
    'backgrounds',
    (value: unknown) => isObjectOfAllowedLiterals(value, defaultBackgrounds),
  ],
  ['measureEnabled', isFalse],
  ['outline', isFalse],
]);

export function muirMoiraStorybookIsInitialGlobal(
  key: string,
  value: unknown,
  parameters: readonly MuirMoiraStorybookLayer[],
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
    muirMoiraStorybookIsObjectLiteral(value) &&
    muirMoiraStorybookList(value['properties']).every((property) => {
      const key = muirMoiraStorybookPropertyKey(property);

      return (
        typeof key === 'string' &&
        allowed
          .get(key)
          ?.includes(
            stringBooleanOrUndefinedOf(
              muirMoiraStorybookField(property, 'value'),
            ),
          ) === true
      );
    })
  );
}

function isDefaultViewportValue(value: MuirMoiraStorybookLayerValue): boolean {
  return (
    value === undefined ||
    [undefined, ...viewportDefaults].includes(stringBooleanOrUndefinedOf(value))
  );
}

const notALiteral = Symbol('not a literal');

function stringBooleanOrUndefinedOf(node: unknown): unknown {
  if (muirMoiraStorybookField(node, 'type') === 'Identifier') {
    return muirMoiraStorybookField(node, 'name') === 'undefined'
      ? undefined
      : notALiteral;
  }

  const type = muirMoiraStorybookField(node, 'type');

  return type === 'StringLiteral' || type === 'BooleanLiteral'
    ? muirMoiraStorybookField(node, 'value')
    : notALiteral;
}
