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
        const ownGlobals = propertyValue(
          storyArgument(unwrap(init)),
          'globals',
        );
        const [runs, ...bases] = storyValues(init, bindings, 'globals');
        const below = [...bases, ...metaGlobals].filter(
          (globals) => globals !== undefined,
        );

        return [
          [runs === ownGlobals ? ownGlobals : undefined, below] as const,
          ...tests.flatMap((test) =>
            test === 'unmatched'
              ? []
              : [
                  [
                    propertyValue(test.options, 'globals'),
                    runs === undefined ? below : [runs, ...below],
                  ] as const,
                ],
          ),
        ];
      }),
      ...(played.length > 0
        ? metaGlobals.map((globals) => [globals, []] as const)
        : []),
    ].filter(([globals]) => globals !== undefined),
  );
}, new Map<unknown, readonly unknown[]>());

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
