import type { MuirMoiraStorybookBindings } from './bindings.ts';
import { muirMoiraStorybookPrimitiveLiteralOf } from './csf-nodes.ts';
import {
  muirMoiraStorybookCsfFile,
  muirMoiraStorybookMayImportItself,
  muirMoiraStorybookStoryMetaOwner,
  muirMoiraStorybookTopLevelBindings,
  muirMoiraStorybookUnchangedBindings,
  type MuirMoiraStorybookTestArguments,
} from './csf.ts';
import { muirMoiraStorybookIsInitialGlobal } from './initial-globals.ts';
import { muirMoiraStorybookIsRecord } from './is-record.ts';
import {
  muirMoiraStorybookField,
  muirMoiraStorybookList,
} from './node-field.ts';
import {
  muirMoiraStorybookIsObjectLiteral,
  muirMoiraStorybookMaySet,
  muirMoiraStorybookPropertyKey,
  muirMoiraStorybookUnknownValue,
  muirMoiraStorybookValuesIn,
  type MuirMoiraStorybookLayerValue,
} from './object-value.ts';
import {
  muirMoiraStorybookPlayedStories,
  type MuirMoiraStorybookPlayedStory,
} from './played-stories.ts';
import {
  muirMoiraStorybookAsWrittenLayer,
  muirMoiraStorybookLayerOf,
  muirMoiraStorybookOwnValue,
  muirMoiraStorybookOwnValueOf,
  muirMoiraStorybookResolvedPropertyValues,
  muirMoiraStorybookRootLayer,
  muirMoiraStorybookValuesOf,
  type MuirMoiraStorybookLayer,
} from './resolved-values.ts';
import { muirMoiraStorybookExtendLevels } from './story-layers.ts';

type Key = string | number;

/** Why removing a property changes nothing: its literal equals the value it falls back to, the object gives its key the same value without it, or it is a global at Storybook 10.6.5's initial value that nothing below it may set. */
export type MuirMoiraStorybookProofReason =
  | 'same-as-below'
  | 'overridden'
  | 'default-global';

/** The proof that removing one property of a site changes nothing in any run of the site (ADR 0006). Only `sitesOf` makes one. */
class MuirMoiraStorybookProven {
  readonly #property: object;
  readonly #reason: MuirMoiraStorybookProofReason;

  constructor(property: object, reason: MuirMoiraStorybookProofReason) {
    this.#property = property;
    this.#reason = reason;
  }

  /** The property node, not its key: a proof for `label: 'a'` says nothing about a later `label: 'c'`. */
  get property(): object {
    return this.#property;
  }

  get reason(): MuirMoiraStorybookProofReason {
    return this.#reason;
  }
}

export type { MuirMoiraStorybookProven };

/** The story data key a site holds. */
type SiteKey = 'args' | 'globals';

/** Where one run of a site takes a key the site holds from: the site, elsewhere (a layer above the meta's object, or another meta the story is made from), or a source the file cannot tell. */
export type MuirMoiraStorybookKeyFrom = 'site' | 'elsewhere' | 'unknown';

interface StoryRun {
  readonly owner: 'story';
  readonly story: MuirMoiraStorybookPlayedStory;
  readonly keyFrom: (key: Key) => MuirMoiraStorybookKeyFrom;
}

interface TestRun {
  readonly owner: 'test';
  readonly story: MuirMoiraStorybookPlayedStory;
  readonly test: MuirMoiraStorybookTestArguments;
  readonly keyFrom: (key: Key) => MuirMoiraStorybookKeyFrom;
}

interface MetaRun {
  readonly owner: 'meta';
  readonly story: MuirMoiraStorybookPlayedStory;
  readonly keyFrom: (key: Key) => MuirMoiraStorybookKeyFrom;
}

/** A story's own object, or its `.test()` options, is the top layer of its run. */
const fromSite = (): MuirMoiraStorybookKeyFrom => 'site';

/** One run of a site, for one played story: its own run, one of its `.test()` calls, or the run that reads the meta's object. */
export type MuirMoiraStorybookSiteRun = StoryRun | TestRun | MetaRun;

/** An object literal a played story runs with as its `args` or `globals`, every run of it, and the proofs that hold in all of them. */
export interface MuirMoiraStorybookSite {
  readonly node: object;
  readonly runs: readonly MuirMoiraStorybookSiteRun[];
  readonly proofs: readonly MuirMoiraStorybookProven[];
}

interface Layers<TRun extends MuirMoiraStorybookSiteRun> {
  readonly run: TRun;
  readonly node: unknown;
  readonly own: MuirMoiraStorybookLayer;
  readonly root: MuirMoiraStorybookLayer;
  readonly parameters: readonly MuirMoiraStorybookLayer[];
}

interface StoryRunLayers extends Layers<StoryRun | TestRun> {
  readonly below: readonly MuirMoiraStorybookLayer[];
  readonly metas: readonly MuirMoiraStorybookLayer[];
}

interface MetaRunLayers extends Layers<MetaRun> {
  readonly otherMetas: readonly MuirMoiraStorybookLayer[];
}

type RunLayers = StoryRunLayers | MetaRunLayers;

/**
 * Every `key` site of the file. A site is chosen as the story's own object, its `.test()` options or the meta give
 * the key, so a written root still has its sites; its layers come only through `rootLayer`, so what a written root
 * gives proves nothing. A file that may import itself proves nothing either, as a write through that import changes
 * what a story runs with; with no `fileName`, its path, any file may.
 */
export function muirMoiraStorybookSitesOf(
  body: readonly unknown[],
  key: SiteKey,
  fileName: string | undefined,
): readonly MuirMoiraStorybookSite[] {
  const mayBeSelfImported =
    fileName === undefined || muirMoiraStorybookMayImportItself(body, fileName);
  const bindings = muirMoiraStorybookTopLevelBindings(body);
  const file = muirMoiraStorybookCsfFile(body, bindings);
  const unchanged = muirMoiraStorybookUnchangedBindings(bindings, file.written);
  const root = (expression: unknown, owner: unknown): MuirMoiraStorybookLayer =>
    muirMoiraStorybookRootLayer(expression, owner, file.written, unchanged);
  const unlessReadByOtherObjects = (
    layer: MuirMoiraStorybookLayer,
    name: unknown,
  ): MuirMoiraStorybookLayer =>
    file.readByOtherObjects.has(name) ? muirMoiraStorybookUnknownValue : layer;
  const metas = file.metas.map(({ object, owner }) => {
    const metaRoot = root(object, owner);

    return {
      object,
      owner,
      root: metaRoot,
      layer: muirMoiraStorybookLayerOf(metaRoot, key),
      ownRoot: unlessReadByOtherObjects(metaRoot, owner),
    };
  });
  const metaLayers = metas.map(({ layer }) => layer);
  const metaParameters = metas.map((meta) =>
    muirMoiraStorybookLayerOf(meta.root, 'parameters'),
  );
  const runs = muirMoiraStorybookPlayedStories(body, bindings, file).flatMap(
    (story): readonly RunLayers[] => {
      const { init, local } = story.story;
      const levels = muirMoiraStorybookExtendLevels(init, local, unchanged);
      const roots = levels.map((level) =>
        level === muirMoiraStorybookUnknownValue
          ? level
          : muirMoiraStorybookRootLayer(
              level.argument,
              level.owner,
              file.written,
              level.bindings,
            ),
      );
      const [own, ...bases] = roots.map((layer) =>
        muirMoiraStorybookLayerOf(layer, key),
      );
      const rootLevel = levels.reduce((_, level) => level);
      const metaOwner =
        rootLevel === muirMoiraStorybookUnknownValue
          ? muirMoiraStorybookUnknownValue
          : muirMoiraStorybookStoryMetaOwner(rootLevel.init);
      const namesAMeta = metas.some(({ owner }) => owner === metaOwner);
      const storyRoot = unlessReadByOtherObjects(roots[0], local);
      const storyParameters = [
        ...roots.map((layer) => muirMoiraStorybookLayerOf(layer, 'parameters')),
        ...metaParameters,
      ];
      const everyRunParameters = [
        ...storyParameters,
        ...story.tests.map((test) =>
          test === 'unmatched'
            ? muirMoiraStorybookUnknownValue
            : muirMoiraStorybookLayerOf(
                root(test.options, undefined),
                'parameters',
              ),
        ),
      ];

      return [
        {
          run: { owner: 'story', story, keyFrom: fromSite },
          node: muirMoiraStorybookOwnValueOf(
            muirMoiraStorybookAsWrittenLayer(
              levels[0].argument,
              levels[0].bindings,
            ),
            key,
          ),
          own: muirMoiraStorybookLayerOf(storyRoot, key),
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
            muirMoiraStorybookField(test.options, 'name'),
          );

          return [
            {
              run: { owner: 'test', story, test, keyFrom: fromSite },
              node: muirMoiraStorybookOwnValue(test.options, key, unchanged),
              own: muirMoiraStorybookLayerOf(optionsOwnRoot, key),
              below: [own, ...bases],
              metas: metaLayers,
              root: optionsOwnRoot,
              parameters: [
                muirMoiraStorybookLayerOf(optionsRoot, 'parameters'),
                ...storyParameters,
              ],
            },
          ];
        }),
        ...metas.map((meta): RunLayers => {
          const node = muirMoiraStorybookOwnValue(meta.object, key, unchanged);

          return {
            run: {
              owner: 'meta',
              story,
              keyFrom: keyFromMeta(
                madeFrom(namesAMeta, metaOwner === meta.owner),
                [own, ...bases],
                node,
                mayBeSelfImported,
              ),
            },
            node,
            own: muirMoiraStorybookLayerOf(meta.ownRoot, key),
            root: meta.ownRoot,
            parameters: everyRunParameters,
            otherMetas: metas
              .filter((other) => other !== meta)
              .map(({ layer }) => layer),
          };
        }),
      ];
    },
  );

  return [...Map.groupBy(runs, ({ node }) => node)].flatMap(
    ([node, all]): readonly MuirMoiraStorybookSite[] =>
      muirMoiraStorybookIsObjectLiteral(node)
        ? [
            {
              node,
              runs: all.map(({ run }) => run),
              proofs: mayBeSelfImported
                ? []
                : key === 'args'
                  ? argsProofs(node, all, unchanged)
                  : globalsProofs(node, all),
            },
          ]
        : [],
  );
}

/** Which meta a story is made from, seen from one meta: an owner that names no meta of the file, such as an alias, cannot be told. */
function madeFrom(
  namesAMeta: boolean,
  isThisMeta: boolean,
): 'this' | 'other' | 'unknown' {
  if (!namesAMeta) {
    return 'unknown';
  }

  return isThisMeta ? 'this' : 'other';
}

/**
 * A meta run's `keyFrom`: for a story made from this meta, its layers above the meta tell; a story made from another
 * meta takes every key elsewhere. In a file that may import itself, a write through the import may remove what a
 * story gives, so elsewhere reads as unknown there; a key such a write adds keeps its mutant, as a story's own does.
 */
function keyFromMeta(
  madeFrom: 'this' | 'other' | 'unknown',
  above: readonly MuirMoiraStorybookLayer[],
  site: unknown,
  mayBeSelfImported: boolean,
): (key: Key) => MuirMoiraStorybookKeyFrom {
  const givenElsewhere: MuirMoiraStorybookKeyFrom = mayBeSelfImported
    ? 'unknown'
    : 'elsewhere';

  if (madeFrom !== 'this') {
    return () => (madeFrom === 'other' ? givenElsewhere : 'unknown');
  }

  return (key) => {
    const from = keyFromLayers(above, site, key);

    return from === 'elsewhere' ? givenElsewhere : from;
  };
}

/** Where a story whose layers above the meta are `above` takes `key` from; a value of the meta's own `site`, spread into the story, is the meta's. */
function keyFromLayers(
  above: readonly MuirMoiraStorybookLayer[],
  site: unknown,
  key: Key,
): MuirMoiraStorybookKeyFrom {
  const value = above.flatMap((layer) =>
    muirMoiraStorybookValuesOf(layer, key),
  )[0];

  if (value === undefined) {
    return 'site';
  }

  if (value === muirMoiraStorybookUnknownValue) {
    return 'unknown';
  }

  return muirMoiraStorybookValuesIn(
    muirMoiraStorybookList(muirMoiraStorybookField(site, 'properties')),
    key,
  ).includes(value)
    ? 'site'
    : 'elsewhere';
}

function argsProofs(
  site: object,
  runs: readonly RunLayers[],
  bindings: MuirMoiraStorybookBindings,
): readonly MuirMoiraStorybookProven[] {
  const properties = muirMoiraStorybookList(
    muirMoiraStorybookField(site, 'properties'),
  );

  return properties.flatMap(
    (property, index): readonly MuirMoiraStorybookProven[] => {
      const key = muirMoiraStorybookPropertyKey(property);

      if (
        !muirMoiraStorybookIsRecord(property) ||
        key === undefined ||
        hasAccessor(properties, key)
      ) {
        return [];
      }

      return [
        ...(isOverridden(properties, property, key, bindings)
          ? [new MuirMoiraStorybookProven(property, 'overridden')]
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
          ? [new MuirMoiraStorybookProven(property, 'same-as-below')]
          : []),
      ];
    },
  );
}

function globalsProofs(
  site: object,
  runs: readonly RunLayers[],
): readonly MuirMoiraStorybookProven[] {
  const properties = muirMoiraStorybookList(
    muirMoiraStorybookField(site, 'properties'),
  );

  return properties.flatMap(
    (property, index): readonly MuirMoiraStorybookProven[] => {
      const key = muirMoiraStorybookPropertyKey(property);

      return muirMoiraStorybookIsRecord(property) &&
        typeof key === 'string' &&
        !hasAccessor(properties, key) &&
        !properties
          .slice(0, index)
          .some((earlier) => muirMoiraStorybookMaySet(earlier, key)) &&
        runs.every((run) => isDefaultGlobal(run, property, key))
        ? [new MuirMoiraStorybookProven(property, 'default-global')]
        : [];
    },
  );
}

function isDefaultGlobal(
  layers: RunLayers,
  property: object,
  key: string,
): boolean {
  const rootMaySetKey = layers.root === muirMoiraStorybookUnknownValue;
  const mayGiveKey =
    'otherMetas' in layers
      ? layers.otherMetas
      : [...layers.below, ...layers.metas];

  return (
    muirMoiraStorybookIsInitialGlobal(
      key,
      muirMoiraStorybookField(property, 'value'),
      layers.parameters,
    ) &&
    !rootMaySetKey &&
    mayGiveKey.every(
      (layer) => muirMoiraStorybookValuesOf(layer, key)[0] === undefined,
    )
  );
}

const accessorKinds: readonly unknown[] = ['get', 'set'];

function hasAccessor(properties: readonly unknown[], key: Key): boolean {
  return properties.some(
    (property) =>
      accessorKinds.includes(muirMoiraStorybookField(property, 'kind')) &&
      muirMoiraStorybookMaySet(property, key),
  );
}

function isOverridden(
  properties: readonly unknown[],
  property: unknown,
  key: Key,
  bindings: MuirMoiraStorybookBindings,
): boolean {
  const kept = muirMoiraStorybookResolvedPropertyValues(
    properties,
    key,
    bindings,
  )[0];

  return (
    muirMoiraStorybookIsRecord(kept) &&
    kept ===
      muirMoiraStorybookResolvedPropertyValues(
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
  bindings: MuirMoiraStorybookBindings,
): boolean {
  const { own } = layers;

  // Stryker disable next-line ConditionalExpression: no run reaches an own layer of another object today; the check keeps the proof sound if one does
  if (typeof own !== 'object' || own.node !== site) {
    return false;
  }

  const siteAsUnknown = (
    layer: MuirMoiraStorybookLayer,
  ): MuirMoiraStorybookLayer =>
    typeof layer === 'object' && layer.node === site
      ? muirMoiraStorybookUnknownValue
      : layer;
  const fallback = [
    ...muirMoiraStorybookResolvedPropertyValues(before, key, bindings),
    ...('otherMetas' in layers
      ? // Stryker disable next-line ArrayDeclaration: a string fallback is no literal node, so sameLiteral is false as for none
        []
      : [
          ...layers.below.flatMap((layer) =>
            muirMoiraStorybookValuesOf(siteAsUnknown(layer), key),
          ),
          metaValue(layers.metas.map(siteAsUnknown), key),
        ]),
  ][0];

  return sameLiteral(muirMoiraStorybookField(property, 'value'), fallback);
}

function metaValue(
  metas: readonly MuirMoiraStorybookLayer[],
  key: Key,
): MuirMoiraStorybookLayerValue {
  const [first, ...more] = metas
    .map((meta) => muirMoiraStorybookValuesOf(meta, key)[0])
    .filter((value) => value !== undefined);

  return more.every((value) => sameLiteral(value, first))
    ? first
    : muirMoiraStorybookUnknownValue;
}

function sameLiteral(node: unknown, other: unknown): boolean {
  const literal = muirMoiraStorybookPrimitiveLiteralOf(node);
  const otherLiteral = muirMoiraStorybookPrimitiveLiteralOf(other);

  return (
    literal !== undefined &&
    otherLiteral !== undefined &&
    Object.is(literal.value, otherLiteral.value)
  );
}
