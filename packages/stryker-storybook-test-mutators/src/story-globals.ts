import {
  csfFile,
  field,
  list,
  playedStories,
  propertyValue,
  storyArgument,
  storyValues,
  topLevelBindings,
  unwrap,
} from '@layzee/storybook-csf';

import type { LzStorybookTestMutator } from './mutator.ts';
import { perFile, readStoryFileAt } from './story-file.ts';

/** What may set a site's globals when one of its keys is removed: the `globals` objects below it, and the `parameters` objects of the stories it runs for, whose `viewport.defaultViewport` the Vitest addon's `setViewport` falls back to. */
interface Below {
  readonly globals: readonly unknown[];
  readonly parameters: readonly unknown[];
}

const defined = (value: unknown): boolean => value !== undefined;

/** The `globals` object literals of the stories that a play or `.test()` call runs for, each with what may set it below. */
const sitesOf = perFile((program): ReadonlyMap<unknown, Below> => {
  const body = list(program.body);
  const bindings = topLevelBindings(body);
  const { metaObjects } = csfFile(body, bindings);
  const metaValues = (key: string) =>
    metaObjects.map((meta) => propertyValue(meta, key)).filter(defined);
  const metaGlobals = metaValues('globals');
  const metaParameters = metaValues('parameters');
  const played = playedStories(body, bindings);

  return bySite(
    [
      ...played.flatMap(({ story: { init }, tests }) => {
        const ownGlobals = propertyValue(
          storyArgument(unwrap(init)),
          'globals',
        );
        const [runs, ...bases] = storyValues(init, bindings, 'globals');
        const parameters = [
          ...storyValues(init, bindings, 'parameters'),
          ...metaParameters,
        ].filter(defined);
        const below = {
          globals: [...bases, ...metaGlobals].filter(defined),
          parameters,
        };

        return [
          [runs === ownGlobals ? ownGlobals : undefined, below] as const,
          ...tests.flatMap((test) =>
            test === 'unmatched'
              ? []
              : [
                  [
                    propertyValue(test.options, 'globals'),
                    {
                      ...below,
                      globals: [runs, ...below.globals].filter(defined),
                    },
                  ] as const,
                ],
          ),
        ];
      }),
      ...(played.length > 0
        ? metaGlobals.map(
            (globals) =>
              [globals, { globals: [], parameters: metaParameters }] as const,
          )
        : []),
    ].filter(([globals]) => globals !== undefined),
  );
}, new Map<unknown, Below>());

/** Each site with what may set it below every story it runs for, as a `.test()` options object can serve several stories, so a key any of them may set keeps its mutant. */
function bySite(
  entries: readonly (readonly [unknown, Below])[],
): ReadonlyMap<unknown, Below> {
  return new Map(
    entries.map(([site]) => {
      const all = entries
        .filter(([other]) => other === site)
        .map(([, below]) => below);

      return [
        site,
        {
          globals: all.flatMap(({ globals }) => globals),
          parameters: all.flatMap(({ parameters }) => parameters),
        },
      ];
    }),
  );
}

// Storybook 10.6.5's own default globals (`initialGlobals` of its viewport, backgrounds, measure and outline
// addons, and its `DEFAULT_VIEWPORT` name). A project's preview `initialGlobals` can differ; the mutator cannot see them.
// The Vitest addon's `setViewport` reads only a viewport global's `value`, and without one falls back to
// `parameters.viewport.defaultViewport`, so a viewport under `parameters.viewport` the file sets is no default.
const viewportDefaults: readonly unknown[] = ['responsive', '100pct-100pct'];

const defaultGlobals: Readonly<Record<string, (value: unknown) => boolean>> = {
  viewport: (value) =>
    viewportDefaults.includes(literalOf(value)) ||
    (field(value, 'type') === 'ObjectExpression' &&
      [undefined, ...viewportDefaults].includes(lastLiteralOf(value, 'value'))),
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
    defaultGlobals[key]?.(field(property, 'value')) === true &&
    !before.some((earlier) => maySet(earlier, key)) &&
    !below.globals.some((globals) => maySetIn(globals, key)) &&
    !(
      key === 'viewport' &&
      below.parameters.some((parameters) => maySetIn(parameters, key))
    )
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
