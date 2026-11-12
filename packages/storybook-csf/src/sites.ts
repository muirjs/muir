import type { Bindings } from './bindings.ts';
import {
  csfFile,
  topLevelBindings,
  unchangedBindings,
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
  asWrittenLayer,
  layerOf,
  ownValue,
  ownValueOf,
  resolvedPropertyValues,
  rootLayer,
  valuesOf,
  type Layer,
} from './resolved-values.ts';
import { extendLevels } from './story-layers.ts';

type Key = string | number;

/** Why removing a property changes nothing: its literal equals the value it falls back to, the object gives its key the same value without it, or it is a global at Storybook 10.6.5's initial value that nothing below it may set. */
export type ProofReason = 'same-as-below' | 'overridden' | 'default-global';

/** The proof that removing one property of a site changes nothing in any run of the site (ADR 0006). Only `sitesOf` makes one. */
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

interface StoryRun {
  readonly owner: 'story';
  readonly story: PlayedStory;
}

interface TestRun {
  readonly owner: 'test';
  readonly story: PlayedStory;
  readonly test: TestArguments;
}

interface MetaRun {
  readonly owner: 'meta';
  readonly story: PlayedStory;
}

/** One run of a site, for one played story: its own run, one of its `.test()` calls, or the run that reads the meta's object. */
export type SiteRun = StoryRun | TestRun | MetaRun;

/** An object literal a played story runs with as its `args` or `globals`, every run of it, and the proofs that hold in all of them. */
export interface Site {
  readonly node: object;
  readonly runs: readonly SiteRun[];
  readonly proofs: readonly Proven[];
}

interface Layers<TRun extends SiteRun> {
  readonly owner: TRun['owner'];
  readonly run: TRun;
  readonly node: unknown;
  readonly own: Layer;
  readonly root: Layer;
  readonly parameters: readonly Layer[];
}

interface StoryRunLayers extends Layers<StoryRun | TestRun> {
  readonly below: readonly Layer[];
  readonly metas: readonly Layer[];
}

interface MetaRunLayers extends Layers<MetaRun> {
  readonly otherMetas: readonly Layer[];
}

type RunLayers = StoryRunLayers | MetaRunLayers;

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
  const unlessReadByOtherObjects = (layer: Layer, name: unknown): Layer =>
    file.readByOtherObjects.has(name) ? unknownValue : layer;
  const metas = file.metas.map(({ object, owner }) => {
    const metaRoot = root(object, owner);

    return {
      object,
      root: metaRoot,
      layer: layerOf(metaRoot, key),
      ownRoot: unlessReadByOtherObjects(metaRoot, owner),
    };
  });
  const metaLayers = metas.map(({ layer }) => layer);
  const metaParameters = metas.map((meta) => layerOf(meta.root, 'parameters'));
  const runs = playedStories(body, bindings, file).flatMap(
    (story): readonly RunLayers[] => {
      const { init, local } = story.story;
      const levels = extendLevels(init, local, unchanged);
      const roots = levels.map((level) =>
        level === unknownValue
          ? level
          : rootLayer(
              level.argument,
              level.owner,
              file.written,
              level.bindings,
            ),
      );
      const [own, ...bases] = roots.map((layer) => layerOf(layer, key));
      const storyRoot = unlessReadByOtherObjects(roots[0], local);
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
          owner: 'story',
          run: { owner: 'story', story },
          node: ownValueOf(
            asWrittenLayer(levels[0].argument, levels[0].bindings),
            key,
          ),
          own: layerOf(storyRoot, key),
          below: bases,
          metas: metaLayers,
          root: storyRoot,
          parameters: everyRunParameters,
        },
        ...story.tests.flatMap((test): readonly RunLayers[] => {
          if (test === 'unmatched') {
            return [];
          }

          const optionsRoot = root(test.options, undefined);
          const optionsOwnRoot = unlessReadByOtherObjects(
            optionsRoot,
            field(test.options, 'name'),
          );

          return [
            {
              owner: 'test',
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
            },
          ];
        }),
        ...metas.map(
          (meta): RunLayers => ({
            owner: 'meta',
            run: { owner: 'meta', story },
            node: ownValue(meta.object, key, unchanged),
            own: layerOf(meta.ownRoot, key),
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
  layers: RunLayers,
  property: object,
  key: string,
): boolean {
  const rootMaySetKey = layers.root === unknownValue;
  const mayGiveKey =
    layers.owner === 'meta'
      ? layers.otherMetas
      : [...layers.below, ...layers.metas];

  return (
    isInitialGlobal(key, field(property, 'value'), layers.parameters) &&
    !rootMaySetKey &&
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
  layers: RunLayers,
  site: object,
  before: readonly unknown[],
  property: object,
  key: Key,
  bindings: Bindings,
): boolean {
  const { own } = layers;

  if (typeof own !== 'object' || own.node !== site) {
    return false;
  }

  const siteAsUnknown = (layer: Layer): Layer =>
    typeof layer === 'object' && layer.node === site ? unknownValue : layer;
  const fallback = [
    ...resolvedPropertyValues(before, key, bindings),
    ...(layers.owner === 'meta'
      ? []
      : [
          ...layers.below.flatMap((layer) =>
            valuesOf(siteAsUnknown(layer), key),
          ),
          metaValue(layers.metas.map(siteAsUnknown), key),
        ]),
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
  const literal = primitiveLiteralOf(node);
  const otherLiteral = primitiveLiteralOf(other);

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

function primitiveLiteralOf(
  node: unknown,
): { readonly value: unknown } | undefined {
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
