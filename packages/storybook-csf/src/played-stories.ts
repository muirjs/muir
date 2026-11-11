import {
  firstTestCalls,
  isIndexedTestCall,
  propertyValue,
  storyArgument,
  testArguments,
  testCallOf,
  unwrap,
  type CsfFile,
  type StoryExport,
  type TestChild,
} from './csf.ts';
import { isRecord } from './is-record.ts';
import { field, list } from './node-field.ts';
import { storyValueChain } from './story-layers.ts';

/** A play that something the file cannot read, such as a spread of an imported object, may set: `'unknown over a play'` when a play the file reads runs if it sets none (an earlier own play, an `.extend()` base's or the meta's), else `'unknown'`. */
export type UnknownPlay = 'unknown' | 'unknown over a play';

/** A tested story that runs a play or a `.test()` call. */
export interface PlayedStory {
  readonly story: StoryExport;
  /** The play Storybook runs for the story, or a top-level function it names; `undefined` when it has none. */
  readonly play: object | UnknownPlay | undefined;
  /** Its `.test()` calls, `'unmatched'` for a call with a spread argument, whose arguments only running the file tells. */
  readonly tests: readonly TestChild[];
}

/** The stories Storybook 10.6.5's Vitest transform tests that run a play or a `.test()` call. In a file with no meta object Storybook indexes no story, so there are none. */
export function playedStories(
  body: readonly unknown[],
  bindings: ReadonlyMap<string, unknown>,
  { metaObjects, stories }: CsfFile,
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
      const [ownOrBasePlay, ...fallbacks] = storyValueChain(
        story.init,
        bindings,
        'play',
      );

      return {
        story,
        play:
          assignedPlay === undefined && ownOrBasePlay === 'unknown'
            ? unknownPlay(
                fallbacks.some((play) => play !== 'unknown') ||
                  metaPlay !== undefined,
              )
            : knownPlay(assignedPlay ?? ownOrBasePlay ?? metaPlay, bindings),
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

function unknownPlay(overAPlay: boolean): UnknownPlay {
  return overAPlay ? 'unknown over a play' : 'unknown';
}

function knownPlay(
  node: unknown,
  bindings: ReadonlyMap<string, unknown>,
): object | undefined {
  const play = topLevelValueOrSelf(node, bindings);

  return isRecord(play) ? play : undefined;
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
