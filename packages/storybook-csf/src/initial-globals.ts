import { field, list } from './node-field.ts';
import { objectValue, propertyKey, type LayerValue } from './object-value.ts';
import { valuesOf, type Layer } from './resolved-values.ts';

// Storybook 10.6.5's own initial globals (`initialGlobals` of its viewport, backgrounds, measure and outline addons,
// and its `DEFAULT_VIEWPORT` name). A project's preview `initialGlobals` can differ; the file does not show them.
const viewportDefaults: readonly unknown[] = ['responsive', '100pct-100pct'];

const defaultBackgrounds: ReadonlyMap<string, readonly unknown[]> = new Map([
  ['value', [undefined]],
  ['grid', [false]],
]);

/** For each global with an initial value, whether a value node is that value, given the `parameters` layers of every run of the site. */
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
      (viewportDefaults.includes(literalOf(value)) ||
        (field(value, 'type') === 'ObjectExpression' &&
          isDefaultViewportValue(objectValue(value, 'value')))),
  ],
  ['backgrounds', (value: unknown) => isObjectOf(value, defaultBackgrounds)],
  ['measureEnabled', isFalse],
  ['outline', isFalse],
]);

/** The value node of global `key` is Storybook 10.6.5's initial value for it, where `parameters` are the `parameters` layers of every run of the site. */
export function isInitialGlobal(
  key: string,
  value: unknown,
  parameters: readonly Layer[],
): boolean {
  return initialGlobals.get(key)?.(value, parameters) === true;
}

function isFalse(value: unknown): boolean {
  return literalOf(value) === false;
}

/** An object literal whose every property is a literal of a key in `allowed`, with a value listed for it. */
function isObjectOf(
  value: unknown,
  allowed: ReadonlyMap<string, readonly unknown[]>,
): boolean {
  return (
    field(value, 'type') === 'ObjectExpression' &&
    list(field(value, 'properties')).every((property) => {
      const key = propertyKey(property);

      return (
        typeof key === 'string' &&
        allowed.get(key)?.includes(literalOf(field(property, 'value'))) === true
      );
    })
  );
}

/** A viewport object's `value` that leaves the viewport at its default: none, `undefined` or a default name. */
function isDefaultViewportValue(value: LayerValue): boolean {
  return (
    value === undefined ||
    [undefined, ...viewportDefaults].includes(literalOf(value))
  );
}

const notALiteral = Symbol('not a literal');

/** The value of a string or boolean literal or the identifier `undefined`; `notALiteral` for any other node. */
function literalOf(node: unknown): unknown {
  if (field(node, 'type') === 'Identifier') {
    return field(node, 'name') === 'undefined' ? undefined : notALiteral;
  }

  const type = field(node, 'type');

  return type === 'StringLiteral' || type === 'BooleanLiteral'
    ? field(node, 'value')
    : notALiteral;
}
