import {
  csfFile,
  storyArgument,
  topLevelBindings,
  unchangedBindings,
  unwrap,
  type TestArguments,
} from './csf.ts';
import { isInitialGlobal } from './initial-globals.ts';
import { isRecord } from './is-record.ts';
import { field, list } from './node-field.ts';
import {
  maySet,
  propertyKey,
  unknownValue,
  type LayerValue,
} from './object-value.ts';
import { playedStories, type PlayedStory } from './played-stories.ts';
import {
  layerOf,
  literalLayer,
  ownValue,
  ownValueOf,
  resolvedPropertyValues,
  rootLayer,
  valuesOf,
  type Layer,
} from './resolved-values.ts';
import { storyRoots } from './story-layers.ts';

type Bindings = ReadonlyMap<string, unknown>;

type Key = string | number;

/** Why removing a property changes nothing: its literal equals the value it falls back to, the object gives its key the same value without it, or it is a global at Storybook 10.6.5's initial value that nothing below it may set. */
export type ProofReason = 'same-as-below' | 'overridden' | 'default-global';

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
type SiteKey = 'args' | 'globals';

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

interface RunLayers {
  readonly run: SiteRun;
  readonly node: unknown;
  readonly own: Layer;
  readonly below: readonly Layer[];
  readonly metas: readonly Layer[];
  readonly root: Layer;
  readonly parameters: readonly Layer[];
  readonly otherMetas: readonly Layer[];
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
  const ownRoot = (layer: Layer, name: unknown): Layer =>
    file.readElsewhere.has(name) ? unknownValue : layer;
  const metas = file.metas.map(({ object, owner }) => {
    const metaRoot = root(object, owner);

    return {
      object,
      root: metaRoot,
      layer: layerOf(metaRoot, key),
      ownRoot: ownRoot(metaRoot, owner),
    };
  });
  const metaLayers = metas.map(({ layer }) => layer);
  const metaParameters = metas.map((meta) => layerOf(meta.root, 'parameters'));
  const runs = playedStories(body, bindings, file).flatMap(
    (story): readonly RunLayers[] => {
      const { init, local } = story.story;
      const roots = storyRoots(init, local, file.written, unchanged, 'root');
      const [own, ...bases] = roots.map((layer) => layerOf(layer, key));
      const storyRoot = ownRoot(roots[0], local);
      const storyParameters = [
        ...roots.map((layer) => layerOf(layer, 'parameters')),
        ...metaParameters,
      ];
      const everyRunParameters = [
        ...storyParameters,
        ...story.tests.map((test) =>
          test === 'unmatched'
            ? unknownValue
            : layerOf(root(test.options, undefined), 'parameters'),
        ),
      ];

      return [
        {
          run: { owner: 'story', story },
          node: ownValueOf(
            literalLayer(storyArgument(unwrap(init)), unchanged),
            key,
          ),
          own: layerOf(storyRoot, key),
          below: bases,
          metas: metaLayers,
          root: storyRoot,
          parameters: everyRunParameters,
          otherMetas: [],
        },
        ...story.tests.flatMap((test): readonly RunLayers[] => {
          if (test === 'unmatched') {
            return [];
          }

          const optionsRoot = root(test.options, undefined);
          const optionsOwnRoot = ownRoot(
            optionsRoot,
            field(test.options, 'name'),
          );

          return [
            {
              run: { owner: 'test', story, test },
              node: ownValue(test.options, key, unchanged),
              own: layerOf(optionsOwnRoot, key),
              below: [own, ...bases],
              metas: metaLayers,
              root: optionsOwnRoot,
              parameters: [
                layerOf(optionsRoot, 'parameters'),
                ...storyParameters,
              ],
              otherMetas: [],
            },
          ];
        }),
        ...metas.map(
          (meta): RunLayers => ({
            run: { owner: 'meta', story },
            node: ownValue(meta.object, key, unchanged),
            own: layerOf(meta.ownRoot, key),
            below: [],
            metas: [],
            root: meta.ownRoot,
            parameters: everyRunParameters,
            otherMetas: metas
              .filter((other) => other !== meta)
              .map(({ layer }) => layer),
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
              proofs:
                key === 'args'
                  ? argsProofs(node, all, unchanged)
                  : globalsProofs(node, all),
            },
          ]
        : [],
  );
}

function argsProofs(
  site: object,
  runs: readonly RunLayers[],
  bindings: Bindings,
): readonly Proven[] {
  const properties = list(field(site, 'properties'));

  return properties.flatMap((property, index): readonly Proven[] => {
    const key = propertyKey(property);

    if (
      !isRecord(property) ||
      key === undefined ||
      hasAccessor(properties, key)
    ) {
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

function globalsProofs(
  site: object,
  runs: readonly RunLayers[],
): readonly Proven[] {
  const properties = list(field(site, 'properties'));

  return properties.flatMap((property, index): readonly Proven[] => {
    const key = propertyKey(property);

    return isRecord(property) &&
      typeof key === 'string' &&
      !hasAccessor(properties, key) &&
      !properties.slice(0, index).some((earlier) => maySet(earlier, key)) &&
      runs.every((run) => isDefaultGlobal(run, property, key))
      ? [new Proven(property, 'default-global')]
      : [];
  });
}

function isDefaultGlobal(
  { root, below, metas, otherMetas, parameters }: RunLayers,
  property: object,
  key: string,
): boolean {
  const mayGiveKey: readonly Layer[] = [
    root === unknownValue ? unknownValue : undefined,
    ...below,
    ...metas,
    ...otherMetas,
  ];

  return (
    isInitialGlobal(key, field(property, 'value'), parameters) &&
    mayGiveKey.every((layer) => valuesOf(layer, key)[0] === undefined)
  );
}

const accessorKinds: readonly unknown[] = ['get', 'set'];

function hasAccessor(properties: readonly unknown[], key: Key): boolean {
  return properties.some(
    (property) =>
      accessorKinds.includes(field(property, 'kind')) && maySet(property, key),
  );
}

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
