import {
  csfFile,
  field,
  list,
  playedStories,
  propertyValue,
  storyArgument,
  topLevelBindings,
  unwrap,
} from '@layzee/storybook-csf';

import type { LzStorybookTestMutator } from './mutator.ts';
import { perFile } from './story-file.ts';

/** The `globals` object literals of the stories that a play or `.test()` call runs for. */
const sitesOf = perFile((program): ReadonlySet<unknown> => {
  const body = list(program.body);
  const bindings = topLevelBindings(body);
  const { metaObjects } = csfFile(body, bindings);
  const played = playedStories(body, bindings);

  return new Set(
    [
      ...played.map(({ story }) => storyArgument(unwrap(story.init))),
      ...(played.length > 0 ? metaObjects : []),
      ...played.flatMap(({ tests }) => tests.map(({ options }) => options)),
    ].map((owner) => propertyValue(owner, 'globals')),
  );
}, new Set());

// Storybook 10.6.5's own default globals (`initialGlobals` of its viewport, backgrounds, measure and outline
// addons, and its `DEFAULT_VIEWPORT` name): a story that sets one runs as it would without it.
const viewportDefaults: readonly unknown[] = ['responsive', '100pct-100pct'];

const defaultGlobals: Readonly<Record<string, (value: unknown) => boolean>> = {
  viewport: (value) =>
    viewportDefaults.includes(literalOf(value)) ||
    isObjectOf(value, {
      value: [undefined, ...viewportDefaults],
      isRotated: [false],
    }),
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
      const key = field(property, 'key', 'name');

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

  return ['StringLiteral', 'BooleanLiteral'].includes(
    String(field(node, 'type')),
  )
    ? field(node, 'value')
    : unknownValue;
}

function isDefaultGlobal(property: unknown): boolean {
  const key = field(property, 'key', 'name');

  return (
    typeof key === 'string' &&
    defaultGlobals[key]?.(field(property, 'value')) === true
  );
}

export function storyGlobalsMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookStoryGlobals';
} {
  return {
    name: 'LzStorybookStoryGlobals',
    sample: `export default { title: 'Sample' };\nexport const Story = {\n  globals: { viewport: { value: 'mobile1' } },\n  play: async () => {},\n};\n`,
    *mutate(path, t) {
      const sites = sitesOf(path);
      const { node } = path;

      if (node.type !== 'ObjectExpression' || !sites.has(node)) {
        return;
      }

      yield* node.properties
        .filter((property) => !isDefaultGlobal(property))
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
