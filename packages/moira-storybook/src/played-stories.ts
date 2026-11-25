import type { MuirMoiraStorybookBindings } from './bindings.ts';
import {
  muirMoiraStorybookIsIndexedTestCall,
  muirMoiraStorybookStoryArgument,
  muirMoiraStorybookUnwrap,
} from './csf-nodes.ts';
import {
  muirMoiraStorybookFirstTestCalls,
  muirMoiraStorybookTestArguments,
  muirMoiraStorybookTestCallOf,
  muirMoiraStorybookTopLevelValueOrSelf,
  muirMoiraStorybookUnchangedBindings,
  type MuirMoiraStorybookCsfFile,
  type MuirMoiraStorybookStoryExport,
  type MuirMoiraStorybookTestChild,
} from './csf.ts';
import { muirMoiraStorybookIsRecord } from './is-record.ts';
import {
  muirMoiraStorybookField,
  muirMoiraStorybookList,
} from './node-field.ts';
import {
  muirMoiraStorybookUnknownValue,
  muirMoiraStorybookWrittenValue,
} from './object-value.ts';
import {
  muirMoiraStorybookAsWrittenLayer,
  muirMoiraStorybookValuesOf,
} from './resolved-values.ts';
import { muirMoiraStorybookExtendLevels } from './story-layers.ts';

/** An unknown play with a play the file reads under it, which runs when the unknown one sets none: an earlier own play, an `.extend()` base's or the meta's. */
export const muirMoiraStorybookUnknownOverAPlay = 'unknown over a play';

/** A play that something the file cannot read, such as a spread of an imported object, may set: `unknownOverAPlay`, or `unknownValue` when no play the file reads is under it. */
export type MuirMoiraStorybookUnknownPlay =
  | typeof muirMoiraStorybookUnknownValue
  | typeof muirMoiraStorybookUnknownOverAPlay;

export function muirMoiraStorybookIsUnknownPlay(
  play: unknown,
): play is MuirMoiraStorybookUnknownPlay {
  return (
    play === muirMoiraStorybookUnknownValue ||
    play === muirMoiraStorybookUnknownOverAPlay
  );
}

/** A tested story that runs a play or a `.test()` call. */
export interface MuirMoiraStorybookPlayedStory {
  readonly story: MuirMoiraStorybookStoryExport;
  /** The play Storybook runs for the story, or a top-level function it names; `undefined` when it has none. */
  readonly play: object | MuirMoiraStorybookUnknownPlay | undefined;
  /** Its `.test()` calls, `'unmatched'` for a call with a spread argument, whose arguments only running the file tells. */
  readonly tests: readonly MuirMoiraStorybookTestChild[];
}

/** The stories Storybook 10.6.5's Vitest transform tests that run a play or a `.test()` call. In a file with no meta object Storybook indexes no story, so there are none. */
export function muirMoiraStorybookPlayedStories(
  body: readonly unknown[],
  bindings: MuirMoiraStorybookBindings,
  { metas, stories, written }: MuirMoiraStorybookCsfFile,
): readonly MuirMoiraStorybookPlayedStory[] {
  if (metas.length === 0) {
    return [];
  }

  const metaObjects = metas.map(({ object }) => object);
  const unchanged = muirMoiraStorybookUnchangedBindings(bindings, written);
  const metaPlays = metaObjects.flatMap((meta) =>
    muirMoiraStorybookValuesOf(
      muirMoiraStorybookAsWrittenLayer(meta, unchanged),
      'play',
    ),
  );

  return stories
    .filter(
      ({ tested, init }) =>
        tested &&
        isTaggedTest([
          ...metaObjects,
          muirMoiraStorybookStoryArgument(muirMoiraStorybookUnwrap(init)),
        ]),
    )
    .map((story) => {
      const assignedPlay = story.runtimeAssignments
        .filter(({ path }) => path.length === 1 && path[0] === 'play')
        .at(-1)?.value;

      return {
        story,
        play: storyPlay(
          assignedPlay,
          muirMoiraStorybookExtendLevels(
            story.init,
            story.local,
            unchanged,
          ).flatMap((level) =>
            muirMoiraStorybookValuesOf(
              level === muirMoiraStorybookUnknownValue
                ? level
                : muirMoiraStorybookAsWrittenLayer(
                    level.argument,
                    level.bindings,
                  ),
              'play',
            ),
          ),
          metaPlays,
          unchanged,
        ),
        tests: testCallsOn(body, story.local).map((test) =>
          test === 'unmatched'
            ? test
            : {
                options: test.options,
                testFunction: muirMoiraStorybookTopLevelValueOrSelf(
                  test.testFunction,
                  unchanged,
                ),
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
      .flatMap((owner) =>
        muirMoiraStorybookList(
          muirMoiraStorybookField(
            muirMoiraStorybookWrittenValue(owner, 'tags'),
            'elements',
          ),
        ),
      )
      .map((tag) => muirMoiraStorybookField(tag, 'value'))
      .filter((tag) => tag === 'test' || tag === '!test')
      .at(-1) !== '!test'
  );
}

/** The play Storybook runs: the last one assigned to the story, else the first of the story's layers, then the meta's, an unknown one over a play when a play the file reads follows it. A story play of `undefined` or `null` runs the meta's, as Storybook 10.6.5 prepareStory runs the story's play `??` the meta's. */
function storyPlay(
  assignedPlay: unknown,
  storyChain: readonly unknown[],
  metaPlays: readonly unknown[],
  bindings: MuirMoiraStorybookBindings,
): object | MuirMoiraStorybookUnknownPlay | undefined {
  const own = assignedPlay ?? storyChain[0];

  if (isNullish(own)) {
    // Stryker disable next-line ArrayDeclaration: a string under the meta's plays is no record, so no play comes from it
    return storyPlay(undefined, metaPlays, [], bindings);
  }

  const [first, ...under] = [...storyChain, ...metaPlays];

  if (assignedPlay === undefined && first === muirMoiraStorybookUnknownValue) {
    return unknownPlay(under.some(muirMoiraStorybookIsRecord));
  }

  return knownPlay(assignedPlay ?? first, bindings);
}

/** `null` or `undefined` written as a value; of the value nodes, only an identifier has a name. */
function isNullish(node: unknown): boolean {
  return (
    muirMoiraStorybookField(node, 'type') === 'NullLiteral' ||
    muirMoiraStorybookField(node, 'name') === 'undefined'
  );
}

function unknownPlay(overAPlay: boolean): MuirMoiraStorybookUnknownPlay {
  return overAPlay
    ? muirMoiraStorybookUnknownOverAPlay
    : muirMoiraStorybookUnknownValue;
}

function knownPlay(
  node: unknown,
  bindings: MuirMoiraStorybookBindings,
): object | undefined {
  const play = muirMoiraStorybookTopLevelValueOrSelf(node, bindings);

  return muirMoiraStorybookIsRecord(play) ? play : undefined;
}

/** The top-level `<story>.test(name, [options,] fn)` calls on a story that Storybook 10.6.5 indexes and runs, the first of each name; a call with a spread argument is `'unmatched'`. */
function testCallsOn(
  body: readonly unknown[],
  local: unknown,
): readonly MuirMoiraStorybookTestChild[] {
  return muirMoiraStorybookFirstTestCalls(
    body
      .flatMap(muirMoiraStorybookTestCallOf)
      .filter(({ target }) => target === local),
  ).flatMap((call): readonly MuirMoiraStorybookTestChild[] => {
    if (muirMoiraStorybookIsIndexedTestCall(call.statement)) {
      return [muirMoiraStorybookTestArguments(call)];
    }

    return call.args.some(
      (arg) => muirMoiraStorybookField(arg, 'type') === 'SpreadElement',
    )
      ? ['unmatched']
      : [];
  });
}
