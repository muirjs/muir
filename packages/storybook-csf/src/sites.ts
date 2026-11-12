import {
  csfFile,
  storyArgument,
  topLevelBindings,
  unchangedBindings,
  unwrap,
  withoutBinding,
  type TestArguments,
} from './csf.ts';
import { isRecord } from './is-record.ts';
import { field, list } from './node-field.ts';
import { propertyKey, unknownValue, type LayerValue } from './object-value.ts';
import { playedStories, type PlayedStory } from './played-stories.ts';
import {
  layerOf,
  ownValue,
  resolvedPropertyValues,
  rootLayer,
  valuesOf,
  type Layer,
} from './resolved-values.ts';
import { ownStoryValue } from './story-layers.ts';

type Bindings = ReadonlyMap<string, unknown>;

type Key = string | number;

/** Why removing a property changes nothing: its literal equals the value it falls back to, or the object gives its key the same value without it. */
export type ProofReason = 'same-as-below' | 'overridden';

/**
 * The proof that removing one property of a site changes nothing in any run of the site (ADR 0006). Only `sitesOf`
 * makes one; it is exported as a type only, and its `#` fields keep a literal with the same members, or a spread copy
 * of one, from passing as one.
 */
class Proven {
  readonly #property: object;
  readonly #reason: ProofReason;

  constructor(property: object, reason: ProofReason) {
    this.#property = property;
    this.#reason = reason;
  }

  /** The property node, not its key: a proof for `label: 'a'` says nothing about a later `label: 'c'`. */
  get property(): object {
    return this.#property;
  }

  get reason(): ProofReason {
    return this.#reason;
  }
}

export type { Proven };

/** The story data key a site holds. */
export type SiteKey = 'args' | 'globals';

/** One run of a site, for one played story: its own run, one of its `.test()` calls, or the run that reads the meta's object. */
export type SiteRun =
  | { readonly owner: 'story' | 'meta'; readonly story: PlayedStory }
  | {
      readonly owner: 'test';
      readonly story: PlayedStory;
      readonly test: TestArguments;
    };

/** An object literal a played story runs with as its `args` or `globals`, every run of it, and the proofs that hold in all of them. */
export interface Site {
  readonly node: object;
  readonly runs: readonly SiteRun[];
  readonly proofs: readonly Proven[];
}

/** One run with what it reads around the site: the object it takes the key from, each layer below it, and the metas. */
interface RunLayers {
  readonly run: SiteRun;
  readonly node: unknown;
  readonly own: Layer;
  readonly below: readonly Layer[];
  readonly metas: readonly Layer[];
}

/**
 * Every `key` site of the file. A site is chosen as the story's own object, its `.test()` options or the meta give
 * the key, so a written root still has its sites; its layers come only through `rootLayer`, so what a written root
 * gives proves nothing.
 */
export function sitesOf(
  body: readonly unknown[],
  key: SiteKey,
): readonly Site[] {
  const bindings = topLevelBindings(body);
  const file = csfFile(body, bindings);
  const unchanged = unchangedBindings(bindings, file.written);
  const root = (expression: unknown, owner: unknown): Layer =>
    rootLayer(expression, owner, file.written, unchanged);
  const metas = file.metas.map(({ object, owner }) => ({
    object,
    layer: layerOf(root(object, owner), key),
  }));
  const metaLayers = metas.map(({ layer }) => layer);
  const runs = playedStories(body, bindings, file).flatMap(
    (story): readonly RunLayers[] => {
      const { init, local } = story.story;
      const [own, ...bases] = storyRoots(
        init,
        local,
        file.written,
        unchanged,
      ).map((layer) => layerOf(layer, key));

      return [
        {
          run: { owner: 'story', story },
          node: ownStoryValue(init, unchanged, key),
          own,
          below: bases,
          metas: metaLayers,
        },
        ...story.tests.flatMap((test): readonly RunLayers[] =>
          test === 'unmatched'
            ? []
            : [
                {
                  run: { owner: 'test', story, test },
                  node: ownValue(test.options, key, unchanged),
                  own: layerOf(root(test.options, undefined), key),
                  below: [own, ...bases],
                  metas: metaLayers,
                },
              ],
        ),
        ...metas.map(
          ({ object, layer }): RunLayers => ({
            run: { owner: 'meta', story },
            node: ownValue(object, key, unchanged),
            own: layer,
            below: [],
            metas: [],
          }),
        ),
      ];
    },
  );

  return [...Map.groupBy(runs, ({ node }) => node)].flatMap(
    ([node, all]): readonly Site[] =>
      isRecord(node) && node['type'] === 'ObjectExpression'
        ? [
            {
              node,
              runs: all.map(({ run }) => run),
              proofs: key === 'args' ? argsProofs(node, all, unchanged) : [],
            },
          ]
        : [],
  );
}

/** A story's own object, then each `.extend()` base, as Storybook 10.6.5 `extend()` merges a base story in; a base the unchanged bindings do not hold is an unknown layer. */
function storyRoots(
  init: unknown,
  owner: unknown,
  written: ReadonlySet<unknown>,
  unchanged: Bindings,
): readonly [Layer, ...Layer[]] {
  const call = unwrap(init);
  const own = rootLayer(storyArgument(call), owner, written, unchanged);
  const base = field(call, 'callee', 'object', 'name');

  if (
    field(call, 'callee', 'property', 'name') !== 'extend' ||
    typeof base !== 'string'
  ) {
    return [own];
  }

  return unchanged.has(base)
    ? [
        own,
        ...storyRoots(
          unchanged.get(base),
          base,
          written,
          withoutBinding(unchanged, base),
        ),
      ]
    : [own, unknownValue];
}

/** The proofs of an `args` site: a property its object overrides, and a literal equal to the value it falls back to in every run. */
function argsProofs(
  site: object,
  runs: readonly RunLayers[],
  bindings: Bindings,
): readonly Proven[] {
  const properties = list(field(site, 'properties'));

  return properties.flatMap((property, index): readonly Proven[] => {
    const key = propertyKey(property);

    if (!isRecord(property) || key === undefined) {
      return [];
    }

    return [
      ...(isOverridden(properties, property, key, bindings)
        ? [new Proven(property, 'overridden')]
        : []),
      ...(runs.every((run) =>
        isSameAsBelow(
          run,
          site,
          properties.slice(0, index),
          property,
          key,
          bindings,
        ),
      )
        ? [new Proven(property, 'same-as-below')]
        : []),
    ];
  });
}

/** The object gives `key` the same value node without `property`. */
function isOverridden(
  properties: readonly unknown[],
  property: unknown,
  key: Key,
  bindings: Bindings,
): boolean {
  const kept = resolvedPropertyValues(properties, key, bindings)[0];

  return (
    isRecord(kept) &&
    kept ===
      resolvedPropertyValues(
        properties.filter((other) => other !== property),
        key,
        bindings,
      )[0]
  );
}

/** In this run, `property` is a literal equal to what `key` falls back to: the properties before it, else the first layer below that sets it, else the metas. Only when the run takes the key from the site itself, as the file shows it; a layer that is the site itself falls away with the property. */
function isSameAsBelow(
  { own, below, metas }: RunLayers,
  site: object,
  before: readonly unknown[],
  property: object,
  key: Key,
  bindings: Bindings,
): boolean {
  if (typeof own !== 'object' || own.node !== site) {
    return false;
  }

  const apart = (layer: Layer): Layer =>
    typeof layer === 'object' && layer.node === site ? unknownValue : layer;
  const fallback = [
    ...resolvedPropertyValues(before, key, bindings),
    ...below.flatMap((layer) => valuesOf(apart(layer), key)),
    metaValue(metas.map(apart), key),
  ][0];

  return sameLiteral(field(property, 'value'), fallback);
}

/** The value the metas give `key`: the one each meta that may set it gives, when they are the same literal; `unknownValue` when they differ. */
function metaValue(metas: readonly Layer[], key: Key): LayerValue {
  const [first, ...more] = metas
    .map((meta) => valuesOf(meta, key)[0])
    .filter((value) => value !== undefined);

  return more.every((value) => sameLiteral(value, first))
    ? first
    : unknownValue;
}

function sameLiteral(node: unknown, other: unknown): boolean {
  const literal = literalOf(node);
  const otherLiteral = literalOf(other);

  return (
    literal !== undefined &&
    otherLiteral !== undefined &&
    Object.is(literal.value, otherLiteral.value)
  );
}

const literalTypes: readonly unknown[] = [
  'StringLiteral',
  'NumericLiteral',
  'BooleanLiteral',
];

/** The value of a literal, a negative number or a template literal without expressions; `undefined` for any other node. */
function literalOf(node: unknown): { readonly value: unknown } | undefined {
  const type = field(node, 'type');

  if (type === 'NullLiteral') {
    return { value: null };
  }

  if (literalTypes.includes(type)) {
    return { value: field(node, 'value') };
  }

  const [quasi, ...more] = list(field(node, 'quasis'));
  const cooked = field(quasi, 'value', 'cooked');

  if (
    type === 'TemplateLiteral' &&
    more.length === 0 &&
    typeof cooked === 'string'
  ) {
    return { value: cooked };
  }

  const negated = field(node, 'argument', 'value');

  return type === 'UnaryExpression' &&
    field(node, 'operator') === '-' &&
    field(node, 'argument', 'type') === 'NumericLiteral' &&
    typeof negated === 'number'
    ? { value: -negated }
    : undefined;
}
