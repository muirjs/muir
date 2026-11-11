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
  type StoryExport,
  type TestChild,
} from './csf.ts';
import { field, list } from './node-field.ts';

/** A tested story that runs a play or a `.test()` call. */
export interface PlayedStory {
  readonly story: StoryExport;
  /** The play Storybook runs for the story, or a top-level function it names; `undefined` when it has none. */
  readonly play: unknown;
  /** Its `.test()` calls, `'unmatched'` for a call with a spread argument, whose arguments only running the file tells. */
  readonly tests: readonly TestChild[];
}

/** The stories Storybook 10.6.5's Vitest transform tests that run a play or a `.test()` call. In a file with no meta object Storybook indexes no story, so there are none. */
export function playedStories(
  body: readonly unknown[],
  bindings: ReadonlyMap<string, unknown>,
): readonly PlayedStory[] {
  const { metaObjects, stories } = csfFile(body, bindings);

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
  const call = unwrap(init);
  const own = playIn(storyArgument(call), bindings);
  const base = field(call, 'callee', 'object', 'name');

  return own === undefined &&
    field(call, 'callee', 'property', 'name') === 'extend' &&
    typeof base === 'string'
    ? ownOrBasePlay(bindings.get(base), withoutBinding(bindings, base))
    : own;
}

/** The play an object literal sets: its last `play` key, or the play of a top-level object it spreads after that key. */
function playIn(
  object: unknown,
  bindings: ReadonlyMap<string, unknown>,
): unknown {
  return list(field(object, 'properties'))
    .toReversed()
    .map((property) => {
      const spread = field(property, 'argument', 'name');

      return field(property, 'type') === 'SpreadElement' &&
        typeof spread === 'string'
        ? playIn(unwrap(bindings.get(spread)), withoutBinding(bindings, spread))
        : propertyValue({ properties: [property] }, 'play');
    })
    .find((play) => play !== undefined);
}
