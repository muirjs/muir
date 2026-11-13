import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { csfShapes } from '../src/csf.ts';
import { type Interaction, interactionsOf } from '../src/interactions.ts';
import { field } from '../src/node-field.ts';
import { programsOf } from './support/parse-module.ts';

interface FollowingCase {
  readonly title: string;
  readonly source: string;
  /** Each interaction's following checks, in source order, as `describeFollowing` gives them. */
  readonly expect: readonly FollowingDescription[];
}

interface FollowingDescription {
  /** Each check's kind, with ` not` for a negative one. */
  readonly checks: readonly string[];
  /** What ends the window, with the flags of an ending interaction. */
  readonly end: string;
  /** The source text of the copied check. */
  readonly copy?: string;
}

/** The play of a story that destructures `contextKeys` from its context and runs `statements`. */
function inPlayWith(
  contextKeys: readonly string[],
  ...statements: readonly string[]
): string {
  return `export const Story = {\n  play: async ({ ${contextKeys.join(', ')} }) => {\n    ${statements.join('\n    ')}\n  },\n};\n`;
}

function inPlay(...statements: readonly string[]): string {
  return inPlayWith(['args', 'canvas', 'userEvent'], ...statements);
}

function textOf(source: string, node: unknown): string | undefined {
  const start = field(node, 'start');
  const end = field(node, 'end');

  return typeof start === 'number' && typeof end === 'number'
    ? source.slice(start, end)
    : undefined;
}

function describeFollowing(
  source: string,
  { following: { checks, end, copy } }: Interaction,
): FollowingDescription {
  const flags =
    end.by === 'interaction'
      ? [
          ...(end.sameList ? ['sameList'] : []),
          ...(end.adjacent ? ['adjacent'] : []),
          ...(end.sameTarget ? ['sameTarget'] : []),
        ]
      : [];
  const copied = textOf(source, copy);

  return {
    checks: checks.map(
      (check) => `${check.kind}${check.negative ? ' not' : ''}`,
    ),
    end: [end.by, ...flags].join(' '),
    ...(copied === undefined ? {} : { copy: copied }),
  };
}

/** The following checks of each interaction of `source`, once per parse. */
function followingIn(
  source: string,
): readonly (readonly FollowingDescription[])[] {
  return programsOf(source).map((program) =>
    interactionsOf(program, csfShapes(program)).all.map((interaction) =>
      describeFollowing(source, interaction),
    ),
  );
}

const followingCases: readonly FollowingCase[] = [
  {
    title:
      'a failing query after an interaction is one of its following checks',
    source: inPlay(
      'await userEvent.click(open);',
      "await canvas.findByRole('dialog');",
    ),
    expect: [{ checks: ['query'], end: 'none' }],
  },
];

describe('interactionsOf following checks', () => {
  followingCases.forEach(({ title, source, expect }) => {
    it(title, () => {
      assert.deepEqual(followingIn(source), [expect, expect]);
    });
  });
});
