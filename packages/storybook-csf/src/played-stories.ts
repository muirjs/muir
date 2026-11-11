import {
  firstTestCalls,
  isIndexedTestCall,
  storyArgument,
  testArguments,
  testCallOf,
  topLevelValueOrSelf,
  unwrap,
  type CsfFile,
  type StoryExport,
  type TestChild,
} from './csf.ts';
import { isRecord } from './is-record.ts';
import { field, list } from './node-field.ts';
import { objectValues, unknownValue, writtenValue } from './object-value.ts';
import { storyValueChain } from './story-layers.ts';

/** An unknown play with a play the file reads under it, which runs when the unknown one sets none: an earlier own play, an `.extend()` base's or the meta's. */
export const unknownOverAPlay = 'unknown over a play';

/** A play that something the file cannot read, such as a spread of an imported object, may set: `unknownOverAPlay`, or `unknownValue` when no play the file reads is under it. */
export type UnknownPlay = typeof unknownValue | typeof unknownOverAPlay;

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

  const metaPlays = metaObjects.flatMap((meta) => objectValues(meta, 'play'));

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
        play: storyPlay(
          assignedPlay,
          [...storyValueChain(story.init, bindings, 'play'), ...metaPlays],
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
      .flatMap((owner) => list(field(writtenValue(owner, 'tags'), 'elements')))
      .map((tag) => field(tag, 'value'))
      .filter((tag) => tag === 'test' || tag === '!test')
      .at(-1) !== '!test'
  );
}

/** The play Storybook runs: the last one assigned to the story, else the first of `chain` (the story's layers, then the meta), an unknown one over a play when a play the file reads follows it. */
function storyPlay(
  assignedPlay: unknown,
  chain: readonly unknown[],
  bindings: ReadonlyMap<string, unknown>,
): object | UnknownPlay | undefined {
  const [first, ...under] = chain;

  if (assignedPlay === undefined && first === unknownValue) {
    return unknownPlay(under.some(isRecord));
  }

  return knownPlay(assignedPlay ?? first, bindings);
}

function unknownPlay(overAPlay: boolean): UnknownPlay {
  return overAPlay ? unknownOverAPlay : unknownValue;
}

function knownPlay(
  node: unknown,
  bindings: ReadonlyMap<string, unknown>,
): object | undefined {
  const play = topLevelValueOrSelf(node, bindings);

  return isRecord(play) ? play : undefined;
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
