import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { waitCall } from '../src/following-checks.ts';
import { field, list } from '../src/node-field.ts';
import {
  type FollowingCase,
  followingIn,
  inPlay,
  inPlayWith,
} from './support/following-checks.ts';
import { programsOf } from './support/parse-module.ts';

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
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'expect(args.onOpen).toHaveBeenCalled();',
      },
    ],
  },
  {
    title: 'an expect.soft call is a check',
    source: inPlay(
      'await userEvent.click(open);',
      'expect.soft(args.onOpen).toHaveBeenCalled();',
    ),
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'expect.soft(args.onOpen).toHaveBeenCalled();',
      },
    ],
  },
  {
    title: 'an expect.element call is a check',
    source: inPlay(
      'await userEvent.click(open);',
      'await expect.element(dialog).toBeVisible();',
    ),
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'await expect.element(dialog).toBeVisible();',
      },
    ],
  },
  {
    title: 'an expect.poll call is a check',
    source: inPlay(
      'await userEvent.click(open);',
      'await expect.poll(() => args.onOpen.mock.calls.length).toBe(1);',
    ),
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'await expect.poll(() => args.onOpen.mock.calls.length).toBe(1);',
      },
    ],
  },
  {
    title: 'an expect.anything call in a check is no check of its own',
    source: inPlay(
      'await userEvent.click(open);',
      'expect(args.onOpen).toHaveBeenCalledWith(expect.anything());',
    ),
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'expect(args.onOpen).toHaveBeenCalledWith(expect.anything());',
      },
    ],
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
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: "expect['soft'](args.onOpen).toHaveBeenCalled();",
      },
    ],
  },
  {
    title: 'a check with .not after its expect call is negative',
    source: inPlay(
      'await userEvent.click(open);',
      'expect(args.onClose).not.toHaveBeenCalled();',
    ),
    expect: [
      {
        checks: ['expect not'],
        end: 'none',
        copy: 'expect(args.onClose).not.toHaveBeenCalled();',
      },
    ],
  },
  {
    title: 'a check with .not further out in its member chain is negative',
    source: inPlay(
      'await userEvent.click(open);',
      'await expect(args.onClose()).resolves.not.toBe(true);',
    ),
    expect: [
      {
        checks: ['expect not'],
        end: 'none',
        copy: 'await expect(args.onClose()).resolves.not.toBe(true);',
      },
    ],
  },
  {
    title: 'a check with .not past a call in its chain is negative',
    source: inPlay(
      'await userEvent.click(open);',
      "expect(args.onClose).withContext('closed').not.toHaveBeenCalled();",
    ),
    expect: [
      {
        checks: ['expect not'],
        end: 'none',
        copy: "expect(args.onClose).withContext('closed').not.toHaveBeenCalled();",
      },
    ],
  },
  {
    title: 'a .not in an argument of a check leaves it positive',
    source: inPlay(
      'await userEvent.click(open);',
      "expect(args.onOpen).toHaveBeenCalledWith(expect.not.stringContaining('x'));",
    ),
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: "expect(args.onOpen).toHaveBeenCalledWith(expect.not.stringContaining('x'));",
      },
    ],
  },
  {
    title:
      'the following checks of a statement come outer before inner, then in source order',
    source: inPlay(
      'await userEvent.click(open);',
      "expect(await canvas.findByRole('dialog')).not.toHaveTextContent(await canvas.findByText('Old'));",
    ),
    expect: [
      {
        checks: ['expect not', 'query', 'query'],
        end: 'none',
        copy: "expect(await canvas.findByRole('dialog')).not.toHaveTextContent(await canvas.findByText('Old'));",
      },
    ],
  },
  {
    title: 'a check inside a function in the window is a following check',
    source: inPlay(
      'await userEvent.click(open);',
      'await waitFor(() => expect(args.onOpen).toHaveBeenCalled());',
      'const later = () => expect(args.onClose).not.toHaveBeenCalled();',
    ),
    expect: [
      {
        checks: ['expect', 'expect not'],
        end: 'none',
        copy: 'await waitFor(() => expect(args.onOpen).toHaveBeenCalled());',
      },
    ],
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
      {
        checks: ['expect'],
        end: 'maybe',
        copy: 'expect(args.onOpen).toHaveBeenCalled();',
      },
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
      {
        checks: ['expect'],
        end: 'none',
        copy: 'expect(args.onOpen).toHaveBeenCalled();',
      },
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
      {
        checks: ['expect'],
        end: 'maybe',
        copy: 'expect(args.onOpen).toHaveBeenCalled();',
      },
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
      {
        checks: ['expect'],
        end: 'maybe',
        copy: 'expect(args.onOpen).toHaveBeenCalled();',
      },
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
      {
        checks: ['expect'],
        end: 'maybe',
        copy: 'expect(args.onOpen).toHaveBeenCalled();',
      },
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
      {
        checks: ['expect'],
        end: 'none',
        copy: 'expect(args.onOpen).toHaveBeenCalled();',
      },
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
      {
        checks: ['expect'],
        end: 'interaction sameList',
        copy: 'expect(args.onOpen).toHaveBeenCalled();',
      },
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
      'an ending interaction whose first argument is the same query awaited has the same target',
    source: inPlay(
      "await userEvent.click(await canvas.findByRole('textbox'));",
      "await userEvent.type(canvas.findByRole('textbox'), 'x');",
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
      {
        checks: ['expect'],
        end: 'step',
        copy: 'expect(args.onOpen).toHaveBeenCalled();',
      },
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
      {
        checks: ['expect'],
        end: 'step',
        copy: 'expect(args.onOpen).toHaveBeenCalled();',
      },
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
      {
        checks: ['expect not'],
        end: 'maybe',
        copy: "expect(canvas.queryByRole('alert')).not.toBeInTheDocument();",
      },
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

interface WaitCallCase {
  readonly title: string;
  /** One statement. */
  readonly source: string;
  /** Whether `waitCall` reads the statement or its expression. */
  readonly at: 'statement' | 'expression';
  readonly expect: ReturnType<typeof waitCall>;
}

const waitCallCases: readonly WaitCallCase[] = [
  {
    title: 'a waitFor call statement is a waitFor call',
    source: 'waitFor(() => expect(dialog).toBeVisible());',
    at: 'statement',
    expect: 'waitFor',
  },
  {
    title: 'an awaited waitFor call statement is a waitFor call',
    source: 'await waitFor(() => expect(dialog).toBeVisible());',
    at: 'statement',
    expect: 'waitFor',
  },
  {
    title: 'a waitFor call is a waitFor call',
    source: 'waitFor(() => expect(dialog).toBeVisible());',
    at: 'expression',
    expect: 'waitFor',
  },
  {
    title: 'a waitForElementToBeRemoved call statement is a removal wait',
    source:
      "await waitForElementToBeRemoved(() => canvas.queryByRole('alert'));",
    at: 'statement',
    expect: 'removal',
  },
  {
    title: 'a call statement of another function is no wait call',
    source: 'sleep(10);',
    at: 'statement',
    expect: undefined,
  },
  {
    title: 'a new expression of waitFor is no wait call',
    source: 'new waitFor(() => expect(dialog).toBeVisible());',
    at: 'statement',
    expect: undefined,
  },
];

describe('waitCall', () => {
  waitCallCases.forEach(({ title, source, at, expect }) => {
    it(title, () => {
      assert.deepEqual(
        programsOf(source).map((program) => {
          const [statement] = list(field(program, 'body'));

          return waitCall(
            at === 'statement' ? statement : field(statement, 'expression'),
          );
        }),
        [expect, expect],
      );
    });
  });
});
