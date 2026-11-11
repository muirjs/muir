import {
  csfFile,
  firstTestCalls,
  isIndexedTestCall,
  propertyValue,
  storyArgument,
  testArguments,
  testCallOf,
  unwrap,
  withoutBinding,
  type CsfFile,
  type StoryExport,
  type TestChild,
} from './csf.ts';
import { field, list } from './node-field.ts';

/** A tested story that runs a play or a `.test()` call. */
export interface PlayedStory {
  readonly story: StoryExport;
  /** The play Storybook runs for the story, or a top-level function it names; `undefined` when it has none, and a spread that does not resolve when that spread may set it. */
  readonly play: unknown;
  /** Its `.test()` calls, `'unmatched'` for a call with a spread argument, whose arguments only running the file tells. */
  readonly tests: readonly TestChild[];
}

/** The stories Storybook 10.6.5's Vitest transform tests that run a play or a `.test()` call. In a file with no meta object Storybook indexes no story, so there are none. */
export function playedStories(
  body: readonly unknown[],
  bindings: ReadonlyMap<string, unknown>,
  { metaObjects, stories }: CsfFile = csfFile(body, bindings),
): readonly PlayedStory[] {
  if (metaObjects.length === 0) {
    return [];
  }

  const metaPlay = metaObjects
    .map((meta) => propertyValue(meta, 'play'))
    .find((play) => play !== undefined);

  return stories
    .filter(
      ({ tested, init }) =>
        tested && isTaggedTest([...metaObjects, storyArgument(unwrap(init))]),
    )
    .map((story) => {
      const assignedPlay = story.runtimeAssignments
        .filter(({ path }) => path.length === 1 && path[0] === 'play')
        .at(-1)?.value;

      return {
        story,
        play: topLevelValueOrSelf(
          assignedPlay ?? ownOrBasePlay(story.init, bindings) ?? metaPlay,
          bindings,
        ),
        tests: testCallsOn(body, story.local).map((test) =>
          test === 'unmatched'
            ? test
            : {
                options: topLevelValueOrSelf(test.options, bindings),
                testFunction: topLevelValueOrSelf(test.testFunction, bindings),
              },
        ),
      };
    })
    .filter(({ play, tests }) => play !== undefined || tests.length > 0);
}

/** Storybook 10.6.5 `combineTags`: a later `test` or `!test` in the static tags of the meta, then the story, wins over an earlier one. */
function isTaggedTest(owners: readonly unknown[]): boolean {
  return (
    owners
      .flatMap((owner) => list(field(propertyValue(owner, 'tags'), 'elements')))
      .map((tag) => field(tag, 'value'))
      .filter((tag) => tag === 'test' || tag === '!test')
      .at(-1) !== '!test'
  );
}

/** A name's top-level value; a name the file does not bind, or any other node, as it is. */
function topLevelValueOrSelf(
  node: unknown,
  bindings: ReadonlyMap<string, unknown>,
): unknown {
  const name = field(node, 'name');

  return (typeof name === 'string' ? bindings.get(name) : undefined) ?? node;
}

/** The top-level `<story>.test(name, [options,] fn)` calls on a story that Storybook 10.6.5 indexes and runs, the first of each name; a call with a spread argument is `'unmatched'`. */
function testCallsOn(
  body: readonly unknown[],
  local: unknown,
): readonly TestChild[] {
  return firstTestCalls(
    body.flatMap(testCallOf).filter(({ target }) => target === local),
  ).flatMap((call): readonly TestChild[] => {
    if (isIndexedTestCall(call.statement)) {
      return [testArguments(call)];
    }

    return call.args.some((arg) => field(arg, 'type') === 'SpreadElement')
      ? ['unmatched']
      : [];
  });
}

/** The story's own play, or for `Base.extend({...})` the one it takes from `Base`, as Storybook 10.6.5 `extend()` merges the base story in. */
function ownOrBasePlay(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
): unknown {
  return storyValues(init, bindings, 'play').find((play) => play !== undefined);
}

/**
 * The properties a story ends up with, one layer each for the story and then each `.extend()` base, as Storybook
 * 10.6.5 `extend()` merges a base story in key by key. Each layer lists its properties last-wins first, with the
 * properties of a top-level object it spreads in place of the spread, as object spread replaces a key whole.
 */
export function storyLayers(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
): readonly (readonly unknown[])[] {
  const call = unwrap(init);
  const own = lastWinsProperties(
    list(field(storyArgument(call), 'properties')),
    bindings,
    (argument, inner) => {
      const name = field(argument, 'name');

      return typeof name === 'string' ? unwrap(inner.get(name)) : undefined;
    },
  );
  const base = field(call, 'callee', 'object', 'name');

  return field(call, 'callee', 'property', 'name') === 'extend' &&
    typeof base === 'string'
    ? [own, ...storyLayers(bindings.get(base), withoutBinding(bindings, base))]
    : [own];
}

/**
 * The value of `key` that each of a story's layers sets, the story's own first; `undefined` for a layer that sets
 * none, and the spread itself for a layer where a spread that does not resolve may set it last, as only running the
 * file tells what that spread sets.
 */
export function storyValues(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
  key: string,
): readonly unknown[] {
  return storyLayers(init, bindings).map((layer) => {
    const winner = winningProperty(layer, key);

    return field(winner, 'type') === 'SpreadElement'
      ? winner
      : propertyValue({ properties: [winner] }, key);
  });
}

/** The value of `key` the story's own object sets when it is the one that runs; `undefined` when a later property replaces it or a later spread that does not resolve may. */
export function ownStoryValue(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
  key: string,
): unknown {
  const [own = []] = storyLayers(init, bindings);
  const winner = winningProperty(own, key);

  return list(field(storyArgument(unwrap(init)), 'properties')).includes(winner)
    ? propertyValue({ properties: [winner] }, key)
    : undefined;
}

/** The first property of a last-wins-first layer that sets `key` or, as a spread that does not resolve, may. */
function winningProperty(layer: readonly unknown[], key: string): unknown {
  return layer.find(
    (property) =>
      field(property, 'type') === 'SpreadElement' ||
      propertyValue({ properties: [property] }, key) !== undefined,
  );
}

/**
 * `properties` last-wins first, each spread whose argument `spreadObject` resolves to an object literal replaced by
 * that object's properties, read the same way without the binding the spread names, so a cycle of spreads ends. A
 * spread it does not resolve stays in its place, for the caller to read as one that may set any key.
 */
export function lastWinsProperties(
  properties: readonly unknown[],
  bindings: ReadonlyMap<string, unknown>,
  spreadObject: (
    argument: unknown,
    bindings: ReadonlyMap<string, unknown>,
  ) => unknown,
): readonly unknown[] {
  return properties.toReversed().flatMap((property) => {
    const argument = field(property, 'argument');
    const spread =
      field(property, 'type') === 'SpreadElement'
        ? spreadObject(argument, bindings)
        : undefined;

    return field(spread, 'type') === 'ObjectExpression'
      ? lastWinsProperties(
          list(field(spread, 'properties')),
          withoutBinding(
            bindings,
            field(argument, 'name') ?? field(argument, 'object', 'name'),
          ),
          spreadObject,
        )
      : [property];
  });
}
