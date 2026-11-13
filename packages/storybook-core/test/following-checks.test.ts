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
  {
    title: 'an expect call after an interaction is one of its following checks',
    source: inPlay(
      'await userEvent.click(open);',
      'expect(args.onOpen).toHaveBeenCalled();',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title: 'an expect.soft call is a check',
    source: inPlay(
      'await userEvent.click(open);',
      'expect.soft(args.onOpen).toHaveBeenCalled();',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title: 'an expect.element call is a check',
    source: inPlay(
      'await userEvent.click(open);',
      'await expect.element(dialog).toBeVisible();',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title: 'an expect.poll call is a check',
    source: inPlay(
      'await userEvent.click(open);',
      'await expect.poll(() => args.onOpen.mock.calls.length).toBe(1);',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title: 'an expect.anything call in a check is no check of its own',
    source: inPlay(
      'await userEvent.click(open);',
      'expect(args.onOpen).toHaveBeenCalledWith(expect.anything());',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title: 'an expect.assertions call is no check',
    source: inPlay('await userEvent.click(open);', 'expect.assertions(1);'),
    expect: [{ checks: [], end: 'none' }],
  },
  {
    title:
      'an expect member under a computed key that is not a string literal is no check',
    source: inPlay(
      'await userEvent.click(open);',
      'expect[soft](args.onOpen).toHaveBeenCalled();',
    ),
    expect: [{ checks: [], end: 'none' }],
  },
  {
    title: "an expect['soft'] call is a check",
    source: inPlay(
      'await userEvent.click(open);',
      "expect['soft'](args.onOpen).toHaveBeenCalled();",
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title: 'a check with .not after its expect call is negative',
    source: inPlay(
      'await userEvent.click(open);',
      'expect(args.onClose).not.toHaveBeenCalled();',
    ),
    expect: [{ checks: ['expect not'], end: 'none' }],
  },
  {
    title: 'a check with .not further out in its member chain is negative',
    source: inPlay(
      'await userEvent.click(open);',
      'await expect(args.onClose()).resolves.not.toBe(true);',
    ),
    expect: [{ checks: ['expect not'], end: 'none' }],
  },
  {
    title: 'a check with .not past a call in its chain is negative',
    source: inPlay(
      'await userEvent.click(open);',
      "expect(args.onClose).withContext('closed').not.toHaveBeenCalled();",
    ),
    expect: [{ checks: ['expect not'], end: 'none' }],
  },
  {
    title: 'a .not in an argument of a check leaves it positive',
    source: inPlay(
      'await userEvent.click(open);',
      "expect(args.onOpen).toHaveBeenCalledWith(expect.not.stringContaining('x'));",
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title:
      'the following checks of a statement come outer before inner, then in source order',
    source: inPlay(
      'await userEvent.click(open);',
      "expect(await canvas.findByRole('dialog')).not.toHaveTextContent(await canvas.findByText('Old'));",
    ),
    expect: [{ checks: ['expect not', 'query', 'query'], end: 'none' }],
  },
  {
    title: 'a check inside a function in the window is a following check',
    source: inPlay(
      'await userEvent.click(open);',
      'await waitFor(() => expect(args.onOpen).toHaveBeenCalled());',
      'const later = () => expect(args.onClose).not.toHaveBeenCalled();',
    ),
    expect: [{ checks: ['expect', 'expect not'], end: 'none' }],
  },
  {
    title:
      'the window continues past the end of the block that holds the interaction into the enclosing one',
    source: inPlay(
      'if (args.open) {',
      '  await userEvent.click(open);',
      "  await canvas.findByRole('dialog');",
      '}',
      'expect(args.onOpen).toHaveBeenCalled();',
    ),
    expect: [{ checks: ['query', 'expect'], end: 'none' }],
  },
  {
    title: 'the window continues out of a step callback',
    source: inPlayWith(
      ['args', 'step', 'userEvent'],
      "await step('open', async () => {",
      '  await userEvent.click(open);',
      '});',
      'expect(args.onOpen).toHaveBeenCalled();',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title: 'the window ends with a function that is not given to a step call',
    source: inPlay(
      'const run = async () => {',
      '  await userEvent.click(open);',
      '};',
      'await run();',
      'expect(args.onOpen).toHaveBeenCalled();',
    ),
    expect: [{ checks: [], end: 'none' }],
  },
  {
    title:
      'the window of an interaction that is the body of a step callback starts at its arrow',
    source: inPlayWith(
      ['args', 'step', 'userEvent'],
      "await step('open', () => userEvent.click(open));",
      'expect(args.onOpen).toHaveBeenCalled();',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title:
      'the window ends at an if that holds an interaction, which may not run',
    source: inPlay(
      'await userEvent.click(open);',
      'expect(args.onOpen).toHaveBeenCalled();',
      'if (args.retry) {',
      '  await userEvent.click(retry);',
      '}',
      'expect(args.onRetry).toHaveBeenCalled();',
    ),
    expect: [
      { checks: ['expect'], end: 'maybe' },
      { checks: ['expect'], end: 'none' },
    ],
  },
  {
    title:
      'a statement holds no interaction in a function that is not given to a step or waitFor call',
    source: inPlay(
      'await userEvent.click(open);',
      'const retry = async () => {',
      '  await userEvent.click(again);',
      '};',
      'expect(args.onOpen).toHaveBeenCalled();',
    ),
    expect: [
      { checks: ['expect'], end: 'none' },
      { checks: [], end: 'none' },
    ],
  },
  {
    title: 'a waitFor call holds an interaction in its callback',
    source: inPlay(
      'await userEvent.click(open);',
      'expect(args.onOpen).toHaveBeenCalled();',
      'await waitFor(async () => {',
      '  await userEvent.click(retry);',
      '});',
      'expect(args.onRetry).toHaveBeenCalled();',
    ),
    expect: [
      { checks: ['expect'], end: 'maybe' },
      { checks: [], end: 'none' },
    ],
  },
  {
    title: 'a statement holds an interaction in a step callback within it',
    source: inPlayWith(
      ['args', 'step', 'userEvent'],
      'await userEvent.click(open);',
      'expect(args.onOpen).toHaveBeenCalled();',
      'if (args.retry) {',
      "  await step('retry', async () => {",
      '    await userEvent.click(retry);',
      '  });',
      '}',
      'expect(args.onRetry).toHaveBeenCalled();',
    ),
    expect: [
      { checks: ['expect'], end: 'maybe' },
      { checks: ['expect'], end: 'none' },
    ],
  },
  {
    title:
      'a waitFor call holds an interaction in a function that its callback defines',
    source: inPlay(
      'await userEvent.click(open);',
      'expect(args.onOpen).toHaveBeenCalled();',
      'await waitFor(async () => {',
      '  const act = async () => {',
      '    await userEvent.click(retry);',
      '  };',
      '  await act();',
      '});',
      'expect(args.onRetry).toHaveBeenCalled();',
    ),
    expect: [
      { checks: ['expect'], end: 'maybe' },
      { checks: [], end: 'none' },
    ],
  },
  {
    title: 'a function declaration holds no interaction',
    source: inPlay(
      'await userEvent.click(open);',
      'async function retry() {',
      '  await userEvent.click(again);',
      '}',
      'expect(args.onOpen).toHaveBeenCalled();',
    ),
    expect: [
      { checks: ['expect'], end: 'none' },
      { checks: [], end: 'none' },
    ],
  },
  {
    title: 'the window ends at the next interaction in the same block',
    source: inPlay(
      'await userEvent.click(open);',
      'expect(args.onOpen).toHaveBeenCalled();',
      'await userEvent.click(close);',
    ),
    expect: [
      { checks: ['expect'], end: 'interaction sameList' },
      { checks: [], end: 'none' },
    ],
  },
  {
    title: 'an interaction that is the very next statement is adjacent',
    source: inPlay(
      'await userEvent.click(open);',
      'await userEvent.click(close);',
    ),
    expect: [
      { checks: [], end: 'interaction sameList adjacent' },
      { checks: [], end: 'none' },
    ],
  },
  {
    title:
      'an interaction in the enclosing block that ends the window is not in the same list',
    source: inPlay(
      'if (args.open) {',
      '  await userEvent.click(open);',
      '}',
      'await userEvent.click(close);',
    ),
    expect: [
      { checks: [], end: 'interaction' },
      { checks: [], end: 'none' },
    ],
  },
  {
    title:
      'an ending interaction whose first argument is equivalent has the same target',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      "await userEvent.type(canvas.getByRole( 'button' ), 'x');",
    ),
    expect: [
      { checks: [], end: 'interaction sameList adjacent sameTarget' },
      { checks: [], end: 'none' },
    ],
  },
  {
    title:
      'an ending interaction has no same target when neither has a first argument',
    source: inPlay('open.focus();', 'open.click();'),
    expect: [
      { checks: [], end: 'interaction sameList adjacent' },
      { checks: [], end: 'none' },
    ],
  },
  {
    title: 'a step call that holds an interaction ends the window by step',
    source: inPlayWith(
      ['args', 'step', 'userEvent'],
      'await userEvent.click(open);',
      'expect(args.onOpen).toHaveBeenCalled();',
      "await step('close', async () => {",
      '  await userEvent.click(close);',
      '});',
    ),
    expect: [
      { checks: ['expect'], end: 'step' },
      { checks: [], end: 'none' },
    ],
  },
  {
    title:
      'an interaction that is the body of a step callback shares no list with the interaction that ends its window',
    source: inPlayWith(
      ['args', 'step', 'userEvent'],
      "await step('open', () => userEvent.click(open));",
      'await userEvent.click(open);',
    ),
    expect: [
      { checks: [], end: 'interaction sameTarget' },
      { checks: [], end: 'none' },
    ],
  },
  {
    title:
      'a step call holds an interaction in a function that its callback defines',
    source: inPlayWith(
      ['args', 'step', 'userEvent'],
      'await userEvent.click(open);',
      'expect(args.onOpen).toHaveBeenCalled();',
      "await step('close', async () => {",
      '  async function close() {',
      '    await userEvent.click(button);',
      '  }',
      '  await close();',
      '});',
      'expect(args.onClose).toHaveBeenCalled();',
    ),
    expect: [
      { checks: ['expect'], end: 'step' },
      { checks: [], end: 'none' },
    ],
  },
  {
    title:
      'negative checks before a conditional interaction end their window by maybe',
    source: inPlay(
      'await userEvent.click(open);',
      "expect(canvas.queryByRole('alert')).not.toBeInTheDocument();",
      'if (args.retry) {',
      '  await userEvent.click(retry);',
      '}',
      "await canvas.findByRole('dialog');",
    ),
    expect: [
      { checks: ['expect not'], end: 'maybe' },
      { checks: ['query'], end: 'none' },
    ],
  },
];

describe('interactionsOf following checks', () => {
  followingCases.forEach(({ title, source, expect }) => {
    it(title, () => {
      assert.deepEqual(followingIn(source), [expect, expect]);
    });
  });
});
