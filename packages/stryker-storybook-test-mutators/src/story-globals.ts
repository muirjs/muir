import {
  csfFile,
  field,
  list,
  ownStoryValue,
  playedStories,
  propertyValue,
  storyValues,
  topLevelBindings,
} from '@layzee/storybook-csf';

import type { LzStorybookTestMutator } from './mutator.ts';
import { perFile, readStoryFileAt } from './story-file.ts';

/** What may set a site's key when it is removed: the `globals` objects below the site, and the `parameters` objects of every layer of every run of the site. */
interface Below {
  readonly globals: readonly unknown[];
  readonly parameters: readonly unknown[];
}

const defined = (value: unknown): boolean => value !== undefined;

/** The `globals` object literals of the stories that a play or `.test()` call runs for, each with what may set it below. */
const sitesOf = perFile((program): ReadonlyMap<unknown, Below> => {
  const body = list(program.body);
  const bindings = topLevelBindings(body);
  const file = csfFile(body, bindings);
  const metaValues = (key: string) =>
    file.metaObjects.map((meta) => propertyValue(meta, key)).filter(defined);
  const metaGlobals = metaValues('globals');
  const metaParameters = metaValues('parameters');
  // A play only a spread that does not resolve may set is no play here: when that spread sets none, the story's globals mutants can only survive.
  const played = playedStories(body, bindings, file).filter(
    ({ play, tests }) =>
      field(play, 'type') !== 'SpreadElement' || tests.length > 0,
  );

  return bySite(
    [
      ...played.flatMap(({ story: { init }, tests }) => {
        const [runs, ...bases] = storyValues(init, bindings, 'globals');
        const storyParameters = [
          ...storyValues(init, bindings, 'parameters'),
          ...metaParameters,
        ].filter(defined);
        const matched = tests.flatMap((test) =>
          test === 'unmatched' ? [] : [test.options],
        );
        const everyRunParameters = [
          ...storyParameters,
          ...matched.map((options) => propertyValue(options, 'parameters')),
        ].filter(defined);
        const globals = [...bases, ...metaGlobals].filter(defined);

        return [
          [
            ownStoryValue(init, bindings, 'globals'),
            { globals, parameters: everyRunParameters },
          ] as const,
          ...matched.map(
            (options) =>
              [
                propertyValue(options, 'globals'),
                {
                  globals: [runs, ...globals].filter(defined),
                  parameters: [
                    propertyValue(options, 'parameters'),
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
    ].filter(([globals]) => defined(globals)),
  );
}, new Map<unknown, Below>());

/** Each site with what may set it below every story it runs for, as a `.test()` options object can serve several stories, so a key any of them may set keeps its mutant. */
function bySite(
  entries: readonly (readonly [unknown, Below])[],
): ReadonlyMap<unknown, Below> {
  return new Map(
    [...Map.groupBy(entries, ([site]) => site)].map(([site, all]) => [
      site,
      {
        globals: all.flatMap(([, below]) => below.globals),
        parameters: all.flatMap(([, below]) => below.parameters),
      },
    ]),
  );
}

// Storybook 10.6.5's own default globals (`initialGlobals` of its viewport, backgrounds, measure and outline
// addons, and its `DEFAULT_VIEWPORT` name). A project's preview `initialGlobals` can differ; the mutator cannot see them.
const viewportDefaults: readonly unknown[] = ['responsive', '100pct-100pct'];

const defaultGlobals: Readonly<
  Record<string, (value: unknown, parameters: readonly unknown[]) => boolean>
> = {
  // The Vitest addon's `setViewport` uses a viewport global's `value`, else `parameters.viewport.defaultViewport`,
  // so a viewport is no default where a `parameters` object of the site's runs may set `viewport`.
  viewport: (value, parameters) =>
    !parameters.some((object) => maySetIn(object, 'viewport')) &&
    (viewportDefaults.includes(literalOf(value)) ||
      (field(value, 'type') === 'ObjectExpression' &&
        [undefined, ...viewportDefaults].includes(
          lastLiteralOf(value, 'value'),
        ))),
  backgrounds: (value) =>
    isObjectOf(value, { value: [undefined], grid: [false] }),
  measureEnabled: isFalse,
  outline: isFalse,
};

function isFalse(value: unknown): boolean {
  return literalOf(value) === false;
}

/** An object literal whose every property is a literal of a key in `allowed`, with a value listed for it. */
function isObjectOf(
  value: unknown,
  allowed: Readonly<Record<string, readonly unknown[]>>,
): boolean {
  return (
    field(value, 'type') === 'ObjectExpression' &&
    list(field(value, 'properties')).every((property) => {
      const key = keyOf(property);

      return (
        typeof key === 'string' &&
        allowed[key]?.includes(literalOf(field(property, 'value'))) === true
      );
    })
  );
}

const unknownValue = Symbol('not a literal');

function literalOf(node: unknown): unknown {
  if (field(node, 'type') === 'Identifier') {
    return field(node, 'name') === 'undefined' ? undefined : unknownValue;
  }

  const type = field(node, 'type');

  return type === 'StringLiteral' || type === 'BooleanLiteral'
    ? field(node, 'value')
    : unknownValue;
}

/** The literal of the last property of an object that may set `key`; `undefined` when none does, and no literal when a spread or computed key may. */
function lastLiteralOf(object: unknown, key: string): unknown {
  const property = list(field(object, 'properties'))
    .toReversed()
    .find((candidate) => maySet(candidate, key));

  if (property === undefined) {
    return undefined;
  }

  return keyOf(property) === key
    ? literalOf(field(property, 'value'))
    : unknownValue;
}

/** The name of a `key: value` property; `undefined` for a computed key, which only running the file resolves. */
function keyOf(property: unknown): unknown {
  return field(property, 'computed') === true
    ? undefined
    : field(property, 'key', 'name');
}

/** A default value of a key that nothing before it in the site, and nothing below the site, may set, so that removing it changes nothing the mutator can see. */
function isDefaultGlobal(
  property: unknown,
  before: readonly unknown[],
  below: Below,
): boolean {
  const key = keyOf(property);

  return (
    typeof key === 'string' &&
    defaultGlobals[key]?.(field(property, 'value'), below.parameters) ===
      true &&
    !before.some((earlier) => maySet(earlier, key)) &&
    !below.globals.some((globals) => maySetIn(globals, key))
  );
}

/** An object that may set `key`: one with a property that may, or no object literal. */
function maySetIn(object: unknown, key: string): boolean {
  return field(object, 'type') === 'ObjectExpression'
    ? list(field(object, 'properties')).some((property) =>
        maySet(property, key),
      )
    : true;
}

/** A property of that key, a spread or a computed key, which only running the file resolves. */
function maySet(property: unknown, key: string): boolean {
  return (
    field(property, 'type') === 'SpreadElement' ||
    field(property, 'computed') === true ||
    keyOf(property) === key
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
