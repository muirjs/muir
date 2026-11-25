import {
  muirMoiraStorybookWithoutBinding,
  type MuirMoiraStorybookBindings,
} from './bindings.ts';
import {
  muirMoiraStorybookIsMember,
  muirMoiraStorybookKeyOf,
  muirMoiraStorybookMemberRoot,
  muirMoiraStorybookUnwrap,
} from './csf-nodes.ts';
import { muirMoiraStorybookIsRecord } from './is-record.ts';
import {
  muirMoiraStorybookField,
  muirMoiraStorybookList,
} from './node-field.ts';
import {
  muirMoiraStorybookIsObjectLiteral,
  muirMoiraStorybookPropertyKey,
  muirMoiraStorybookUnknownValue,
  muirMoiraStorybookValuesIn,
  type MuirMoiraStorybookLayerValue,
  type MuirMoiraStorybookObjectLiteral,
} from './object-value.ts';

/** The value the last property of exactly `key` gives it, as `shownObject` reads `object`, past any spread or computed key the file does not resolve, which may or may not set it: the object a site is when nothing the file reads replaces it. `undefined` for an object the file does not show, which is no site. */
export function muirMoiraStorybookOwnValue(
  object: unknown,
  key: string,
  bindings: MuirMoiraStorybookBindings,
): MuirMoiraStorybookLayerValue {
  return muirMoiraStorybookOwnValueOf(shownObject(object, bindings), key);
}

export function muirMoiraStorybookOwnValueOf(
  layer: MuirMoiraStorybookLayer,
  key: string,
): MuirMoiraStorybookLayerValue {
  return typeof layer === 'object'
    ? muirMoiraStorybookValuesIn(
        layer.lastWinsProperties.filter(
          (property) => muirMoiraStorybookPropertyKey(property) === key,
        ),
        key,
      )[0]
    : layer;
}

/** Every value that `properties`, in source order, give `key`, the one JavaScript keeps first, each spread read as `shownObject` reads it. */
export function muirMoiraStorybookResolvedPropertyValues(
  properties: readonly unknown[],
  key: string | number,
  bindings: MuirMoiraStorybookBindings,
): readonly MuirMoiraStorybookLayerValue[] {
  return muirMoiraStorybookValuesIn(inLastWinsOrder(properties, bindings), key);
}

class MuirMoiraStorybookResolvedObject {
  readonly #node: MuirMoiraStorybookObjectLiteral;
  readonly #bindings: MuirMoiraStorybookBindings;

  constructor(
    node: MuirMoiraStorybookObjectLiteral,
    bindings: MuirMoiraStorybookBindings,
  ) {
    this.#node = node;
    this.#bindings = bindings;
  }

  get node(): MuirMoiraStorybookObjectLiteral {
    return this.#node;
  }

  get lastWinsProperties(): readonly unknown[] {
    return inLastWinsOrder(
      muirMoiraStorybookList(muirMoiraStorybookField(this.#node, 'properties')),
      this.#bindings,
    );
  }

  layerOf(key: string | number): MuirMoiraStorybookLayer {
    const value = muirMoiraStorybookValuesIn(this.lastWinsProperties, key)[0];

    return typeof value === 'object'
      ? (shownObject(value, this.#bindings) ?? muirMoiraStorybookUnknownValue)
      : value;
  }
}

export type { MuirMoiraStorybookResolvedObject };

export type MuirMoiraStorybookLayer =
  | MuirMoiraStorybookResolvedObject
  | typeof muirMoiraStorybookUnknownValue
  | undefined;

export function muirMoiraStorybookRootLayer(
  expression: unknown,
  owner: unknown,
  written: ReadonlySet<unknown>,
  unchanged: MuirMoiraStorybookBindings,
): MuirMoiraStorybookLayer {
  if (expression === undefined) {
    return undefined;
  }

  return written.has(owner)
    ? muirMoiraStorybookUnknownValue
    : (shownObject(expression, unchanged) ?? muirMoiraStorybookUnknownValue);
}

export function muirMoiraStorybookAsWrittenLayer(
  expression: unknown,
  bindings: MuirMoiraStorybookBindings,
): MuirMoiraStorybookLayer {
  return muirMoiraStorybookIsObjectLiteral(expression)
    ? new MuirMoiraStorybookResolvedObject(expression, bindings)
    : undefined;
}

export function muirMoiraStorybookLayerOf(
  layer: MuirMoiraStorybookLayer,
  key: string | number,
): MuirMoiraStorybookLayer {
  return typeof layer === 'object' ? layer.layerOf(key) : layer;
}

export function muirMoiraStorybookValuesOf(
  layer: MuirMoiraStorybookLayer,
  key: string | number,
): readonly MuirMoiraStorybookLayerValue[] {
  if (layer === undefined) {
    return [];
  }

  return layer === muirMoiraStorybookUnknownValue
    ? [muirMoiraStorybookUnknownValue]
    : muirMoiraStorybookValuesIn(layer.lastWinsProperties, key);
}

/**
 * The object literal `node` shows, read through `as const`, `satisfies` and parentheses, a name `bindings` holds,
 * and a member with a static key such as `Base.args`; `undefined` for one the file does not show. Given
 * `unchangedBindings`, a name the file may change reads as one it does not show.
 */
function shownObject(
  node: unknown,
  bindings: MuirMoiraStorybookBindings,
): MuirMoiraStorybookResolvedObject | undefined {
  const current = muirMoiraStorybookUnwrap(node);
  const name = muirMoiraStorybookField(current, 'name');

  if (muirMoiraStorybookIsObjectLiteral(current)) {
    return new MuirMoiraStorybookResolvedObject(current, bindings);
  }

  if (typeof name === 'string') {
    return bindings.has(name)
      ? shownObject(
          bindings.get(name),
          muirMoiraStorybookWithoutBinding(bindings, name),
        )
      : undefined;
  }

  const key = muirMoiraStorybookKeyOf(current);
  const object = muirMoiraStorybookIsMember(current)
    ? shownObject(muirMoiraStorybookField(current, 'object'), bindings)
    : undefined;
  const value =
    object === undefined || typeof key !== 'string'
      ? undefined
      : muirMoiraStorybookValuesIn(object.lastWinsProperties, key)[0];

  // Without the member's root name, a value that names the member again, as in `const A = { b: A.b }`, ends.
  return muirMoiraStorybookIsRecord(value)
    ? shownObject(
        value,
        muirMoiraStorybookWithoutBinding(
          bindings,
          muirMoiraStorybookField(
            muirMoiraStorybookMemberRoot(current),
            'name',
          ),
        ),
      )
    : undefined;
}

/** `properties` last-wins first, each spread of an object `shownObject` reads replaced by that object's properties; a spread it does not read stays in place, for `valuesIn` to read as one that may set any key. */
function inLastWinsOrder(
  properties: readonly unknown[],
  bindings: MuirMoiraStorybookBindings,
): readonly unknown[] {
  return properties
    .toReversed()
    .flatMap(
      (property) =>
        shownObject(muirMoiraStorybookField(property, 'argument'), bindings)
          ?.lastWinsProperties ?? [property],
    );
}
