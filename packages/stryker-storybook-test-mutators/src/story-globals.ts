import {
  csfFile,
  field,
  list,
  playedStories,
  propertyValue,
  storyArgument,
  topLevelBindings,
  unwrap,
  withoutBinding,
} from '@layzee/storybook-csf';

import type { LzStorybookTestMutator } from './mutator.ts';
import { perFile, readStoryFileAt } from './story-file.ts';

/** The `globals` object literals of the stories that a play or `.test()` call runs for, each with the `globals` objects below it in the file, whose value of a key comes back when the site's is removed. */
const sitesOf = perFile((program): ReadonlyMap<unknown, readonly unknown[]> => {
  const body = list(program.body);
  const bindings = topLevelBindings(body);
  const metaGlobals = csfFile(body, bindings)
    .metaObjects.map((meta) => propertyValue(meta, 'globals'))
    .filter((globals) => globals !== undefined);
  const played = playedStories(body, bindings);

  return new Map<unknown, readonly unknown[]>(
    [
      ...played.flatMap(({ story: { init }, tests }) => {
        const [storyGlobals, ...inherited] = globalsIn(init, bindings);
        const below = [...inherited, ...metaGlobals].filter(
          (globals) => globals !== undefined,
        );

        return [
          [storyGlobals, below] as const,
          ...tests.map(
            ({ options }) =>
              [
                propertyValue(options, 'globals'),
                storyGlobals === undefined ? below : [storyGlobals, ...below],
              ] as const,
          ),
        ];
      }),
      ...(played.length > 0
        ? metaGlobals.map((globals) => [globals, []] as const)
        : []),
    ].filter(([globals]) => globals !== undefined),
  );
}, new Map<unknown, readonly unknown[]>());

/** The `globals` objects a story takes from the top-level stories it spreads and from its `.extend()` bases. */
function inheritedGlobals(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
): readonly unknown[] {
  const call = unwrap(init);
  const base = field(call, 'callee', 'object', 'name');
  const spreads = list(field(storyArgument(call), 'properties')).flatMap(
    (property) => {
      const spread = field(property, 'argument', 'name');

      return field(property, 'type') === 'SpreadElement' &&
        typeof spread === 'string'
        ? globalsIn(bindings.get(spread), withoutBinding(bindings, spread))
        : [];
    },
  );

  return field(call, 'callee', 'property', 'name') === 'extend' &&
    typeof base === 'string'
    ? [
        ...spreads,
        ...globalsIn(bindings.get(base), withoutBinding(bindings, base)),
      ]
    : spreads;
}

/** A story's own `globals`, then those it takes from the stories it spreads and its `.extend()` bases; `undefined` where one sets none. */
function globalsIn(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
): readonly unknown[] {
  return [
    propertyValue(storyArgument(unwrap(init)), 'globals'),
    ...inheritedGlobals(init, bindings),
  ];
}

// Storybook 10.6.5's own default globals (`initialGlobals` of its viewport, backgrounds, measure and outline
// addons, and its `DEFAULT_VIEWPORT` name). A project's preview `initialGlobals` can differ; the mutator cannot see them.
const viewportDefaults: readonly unknown[] = ['responsive', '100pct-100pct'];

const defaultGlobals: Readonly<Record<string, (value: unknown) => boolean>> = {
  viewport: (value) =>
    viewportDefaults.includes(literalOf(value)) ||
    (field(value, 'type') === 'ObjectExpression' &&
      [undefined, ...viewportDefaults].includes(
        literalOf(propertyValue(value, 'value')),
      )),
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

/** The name of a `key: value` property; `undefined` for a computed key, which only running the file resolves. */
function keyOf(property: unknown): unknown {
  return field(property, 'computed') === true
    ? undefined
    : field(property, 'key', 'name');
}

/** A default value of a key that nothing before it in the site, and no `globals` object below the site, may set, so that removing it changes nothing the mutator can see. */
function isDefaultGlobal(
  property: unknown,
  before: readonly unknown[],
  below: readonly unknown[],
): boolean {
  const key = keyOf(property);

  return (
    typeof key === 'string' &&
    defaultGlobals[key]?.(field(property, 'value')) === true &&
    !before.some((earlier) => maySet(earlier, key)) &&
    !below.some((globals) =>
      field(globals, 'type') === 'ObjectExpression'
        ? list(field(globals, 'properties')).some((set) => maySet(set, key))
        : true,
    )
  );
}

/** A property of that key, a spread or a computed key, which only running the file resolves. */
function maySet(property: unknown, key: string): boolean {
  return (
    field(property, 'type') === 'SpreadElement' ||
    field(property, 'computed') === true ||
    field(property, 'key', 'name') === key
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
