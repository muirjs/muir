import {
  csfFile,
  field,
  list,
  maySet,
  maySetIn,
  objectValue,
  ownStoryValue,
  ownValue,
  playedStories,
  propertyKey,
  resolvedValue,
  storyValues,
  topLevelBindings,
  unchangedBindings,
  unknownValue,
  type LayerValue,
} from '@layzee/storybook-csf';

import type { LzStorybookTestMutator } from './mutator.ts';
import { perFile, readStoryFileAt } from './story-file.ts';

/** What may set a site's key when it is removed: the `globals` objects below the site, and the `parameters` objects of every layer of every run of the site. */
interface Below {
  readonly globals: readonly LayerValue[];
  readonly parameters: readonly LayerValue[];
  /** The bindings the file leaves unchanged, which `maySetIn` reads these objects through. */
  readonly bindings: ReadonlyMap<string, unknown>;
}

const defined = (value: LayerValue): value is NonNullable<LayerValue> =>
  value !== undefined;

/** The `globals` object literals of the stories that a play or `.test()` call runs for, each with what may set it below. */
const sitesOf = perFile((program): ReadonlyMap<unknown, Below> => {
  const body = list(program.body);
  const bindings = topLevelBindings(body);
  const file = csfFile(body, bindings);
  const unchanged = unchangedBindings(bindings, file.written);
  const metaValues = (key: string) =>
    file.metaObjects
      .map((meta) => resolvedValue(meta, key, unchanged))
      .filter(defined);
  const metaGlobals = metaValues('globals');
  const metaParameters = metaValues('parameters');
  // An unknown play with no play under it is no play here: when what may set it sets none, the story's globals mutants can only survive.
  const played = playedStories(body, bindings, file).filter(
    ({ play, tests }) => play !== unknownValue || tests.length > 0,
  );

  return bySite(
    [
      ...played.flatMap(({ story: { init }, tests }) => {
        const [runs, ...bases] = storyValues(init, unchanged, 'globals');
        const storyParameters = [
          ...storyValues(init, unchanged, 'parameters'),
          ...metaParameters,
        ].filter(defined);
        const matched = tests.flatMap((test) =>
          test === 'unmatched' ? [] : [test.options],
        );
        const everyRunParameters = [
          ...storyParameters,
          ...tests
            .map((test) =>
              test === 'unmatched'
                ? unknownValue
                : resolvedValue(test.options, 'parameters', unchanged),
            )
            .filter(defined),
        ];
        const globals = [...bases, ...metaGlobals].filter(defined);

        return [
          [
            ownStoryValue(init, unchanged, 'globals'),
            { globals, parameters: everyRunParameters },
          ] as const,
          ...matched.map(
            (options) =>
              [
                ownValue(options, 'globals', unchanged),
                {
                  globals: [runs, ...globals].filter(defined),
                  parameters: [
                    resolvedValue(options, 'parameters', unchanged),
                    ...storyParameters,
                  ].filter(defined),
                },
              ] as const,
          ),
          ...metaGlobals.map(
            (site) =>
              [site, { globals: [], parameters: everyRunParameters }] as const,
          ),
        ];
      }),
    ],
    unchanged,
  );
}, new Map<unknown, Below>());

/** Each site with what may set it below every story it runs for, as a `.test()` options object can serve several stories, so a key any of them may set keeps its mutant. No `globals` object, or one the file does not show, is no site. */
function bySite(
  entries: readonly (readonly [LayerValue, Omit<Below, 'bindings'>])[],
  bindings: ReadonlyMap<string, unknown>,
): ReadonlyMap<unknown, Below> {
  const sites = entries.filter(
    ([site]) => defined(site) && site !== unknownValue,
  );

  return new Map(
    [...Map.groupBy(sites, ([site]) => site)].map(([site, all]) => [
      site,
      {
        globals: all.flatMap(([, below]) => below.globals),
        parameters: all.flatMap(([, below]) => below.parameters),
        bindings,
      },
    ]),
  );
}

// Storybook 10.6.5's own default globals (`initialGlobals` of its viewport, backgrounds, measure and outline
// addons, and its `DEFAULT_VIEWPORT` name). A project's preview `initialGlobals` can differ; the mutator cannot see them.
const viewportDefaults: readonly unknown[] = ['responsive', '100pct-100pct'];

const defaultBackgrounds: ReadonlyMap<string, readonly unknown[]> = new Map([
  ['value', [undefined]],
  ['grid', [false]],
]);

const defaultGlobals: ReadonlyMap<
  string,
  (value: unknown, below: Below) => boolean
> = new Map([
  [
    // The Vitest addon's `setViewport` uses a viewport global's `value`, else `parameters.viewport.defaultViewport`,
    // so a viewport is no default where a `parameters` object of the site's runs may set `viewport`.
    'viewport',
    (value: unknown, { parameters, bindings }: Below) =>
      !parameters.some((object) => maySetIn(object, 'viewport', bindings)) &&
      (viewportDefaults.includes(literalOf(value)) ||
        (field(value, 'type') === 'ObjectExpression' &&
          isDefaultViewportValue(objectValue(value, 'value')))),
  ],
  ['backgrounds', (value: unknown) => isObjectOf(value, defaultBackgrounds)],
  ['measureEnabled', isFalse],
  ['outline', isFalse],
]);

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

function literalOf(node: unknown): unknown {
  if (field(node, 'type') === 'Identifier') {
    return field(node, 'name') === 'undefined' ? undefined : notALiteral;
  }

  const type = field(node, 'type');

  return type === 'StringLiteral' || type === 'BooleanLiteral'
    ? field(node, 'value')
    : notALiteral;
}

/** A default value of a key that nothing before it in the site, and nothing below the site, may set, so that removing it changes nothing the mutator can see. */
function isDefaultGlobal(
  property: unknown,
  before: readonly unknown[],
  below: Below,
): boolean {
  const key = propertyKey(property);

  return (
    typeof key === 'string' &&
    defaultGlobals.get(key)?.(field(property, 'value'), below) === true &&
    !before.some((earlier) => maySet(earlier, key)) &&
    !below.globals.some((globals) => maySetIn(globals, key, below.bindings))
  );
}

export function storyGlobalsMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookStoryGlobals';
} {
  return {
    name: 'LzStorybookStoryGlobals',
    sample: `export default { title: 'Sample' };\nexport const Story = {\n  globals: { viewport: { value: 'mobile1' } },\n  play: async () => {},\n};\n`,
    *mutate(path, t) {
      readStoryFileAt(path, sitesOf);

      const { node } = path;

      if (node.type !== 'ObjectExpression') {
        return;
      }

      const below = sitesOf(path).get(node);

      if (below === undefined) {
        return;
      }

      yield* node.properties
        .filter(
          (property, index) =>
            !isDefaultGlobal(property, node.properties.slice(0, index), below),
        )
        .map((removed) =>
          t.objectExpression(
            node.properties
              .filter((property) => property !== removed)
              .map((property) => t.cloneNode(property)),
          ),
        );
    },
  };
}
