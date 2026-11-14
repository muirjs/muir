import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { csfShapes } from '../src/csf.ts';
import { interactionsOf } from '../src/interactions.ts';
import { isRecord } from '../src/is-record.ts';
import { field } from '../src/node-field.ts';
import { descendants, indexTree } from '../src/node-tree.ts';
import {
  type FollowingCase,
  followingIn,
  inPlay,
  textOf,
} from './support/following-checks.ts';
import { programsOf } from './support/parse-module.ts';
import { inPlayWith } from './support/story-source.ts';

const copyCases: readonly FollowingCase[] = [
  {
    title:
      "the check statement of the first expect check in the interaction's own list is copied",
    source: inPlay(
      'await userEvent.click(save);',
      "await canvas.findByRole('status');",
      'await expect(args.onSave).toHaveBeenCalled();',
      'expect(args.onClose).not.toHaveBeenCalled();',
    ),
    expect: [
      {
        checks: ['query', 'expect', 'expect not'],
        end: 'none',
        copy: 'await expect(args.onSave).toHaveBeenCalled();',
      },
    ],
  },
  {
    title:
      'a statement that holds the first expect check but is no check statement is not copied',
    source: inPlay(
      'await userEvent.click(save);',
      'if (args.saved) {',
      '  expect(args.onSave).toHaveBeenCalled();',
      '}',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title:
      'a waitFor statement whose callback holds the first expect check is copied',
    source: inPlay(
      'await userEvent.click(open);',
      "await waitFor(() => expect(canvas.getByRole('dialog')).toBeVisible());",
    ),
    expect: [
      {
        checks: ['expect', 'query'],
        end: 'none',
        copy: "await waitFor(() => expect(canvas.getByRole('dialog')).toBeVisible());",
      },
    ],
  },
  {
    title:
      'a waitFor statement whose first expect check is in an argument other than its callback is not copied',
    source: inPlay(
      'await userEvent.click(open);',
      'await waitFor(() => args.onPing(), { onTimeout: () => expect(dialog).toBeVisible() });',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title:
      'a waitFor statement whose callback holds only a new expression of expect is not copied',
    source: inPlay(
      'await userEvent.click(open);',
      'await waitFor(() => new expect(dialog), { onTimeout: () => expect(dialog).toBeVisible() });',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title:
      'an export assignment that holds the first expect check is not copied',
    source: [
      'export = expect(a).toBe(1);',
      'userEvent.click(open);',
      'export = expect(a).toBe(1);',
    ].join('\n'),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title:
      'a statement of a call other than waitFor whose callback holds the first expect check is not copied',
    source: inPlay(
      'await userEvent.click(open);',
      'await retry(() => expect(dialog).toBeVisible());',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title: "a check statement outside the interaction's own list is not copied",
    source: inPlay(
      'for (const item of args.items) {',
      '  await userEvent.click(item);',
      '}',
      'expect(args.onPick).toHaveBeenCalled();',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title:
      'a check statement that reads a name declared between the interaction and it is not copied',
    source: inPlay(
      'await userEvent.click(save);',
      "const status = canvas.getByRole('status');",
      "expect(status).toHaveTextContent('Saved');",
    ),
    expect: [{ checks: ['query', 'expect'], end: 'none' }],
  },
  {
    title:
      'a check statement that reads a name written between the interaction and it is not copied',
    source: inPlay(
      'let count = 0;',
      'await userEvent.click(add);',
      'count += 1;',
      'expect(args.onAdd).toHaveBeenCalledTimes(count);',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title:
      'a check statement equivalent to one before the interaction in the function around it is not copied',
    source: inPlay(
      "expect(canvas.getByRole('form')).toBeVisible();",
      'await userEvent.click(save);',
      "expect(canvas.getByRole( 'form' )).toBeVisible();",
    ),
    expect: [{ checks: ['expect', 'query'], end: 'none' }],
  },
  {
    title:
      'a check statement equivalent to one before the interaction in the outermost function around it is not copied',
    source: inPlayWith(
      ['args', 'canvas', 'step', 'userEvent'],
      "expect(canvas.getByRole('form')).toBeVisible();",
      "await step('save', async () => {",
      '  await userEvent.click(save);',
      "  expect(canvas.getByRole('form')).toBeVisible();",
      '});',
    ),
    expect: [{ checks: ['expect', 'query'], end: 'none' }],
  },
  {
    title:
      'a check statement after an interaction outside any function is copied whatever stands before the interaction',
    source: [
      "import { expect, userEvent } from 'storybook/test';",
      'expect(form).toBeVisible();',
      'await userEvent.click(save);',
      'expect(form).toBeVisible();',
    ].join('\n'),
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'expect(form).toBeVisible();',
      },
    ],
  },
  {
    title:
      'the check after an interaction is copied to run before the interaction too',
    source: inPlay(
      'await userEvent.click(save);',
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'await expect(args.onSave).toHaveBeenCalled();',
      },
    ],
  },
  {
    title:
      'the copied check is the first check statement after the interaction, past statements that check nothing',
    source: inPlay(
      'await userEvent.click(save);',
      'await sleep(10);',
      "await expect(canvas.getByRole('status')).toHaveTextContent('Saved');",
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [
      {
        checks: ['expect', 'query', 'expect'],
        end: 'none',
        copy: "await expect(canvas.getByRole('status')).toHaveTextContent('Saved');",
      },
    ],
  },
  {
    title:
      'a waitFor that is not awaited and holds the first check is copied as written',
    source: inPlay(
      'await userEvent.click(open);',
      'waitFor(() => expect(dialog).toBeVisible());',
    ),
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'waitFor(() => expect(dialog).toBeVisible());',
      },
    ],
  },
  {
    title:
      'an interaction whose first check is in a waitFor argument other than its callback has no copy, as the copy would run the callback before the interaction and check nothing',
    source: inPlay(
      'await userEvent.click(open);',
      'await waitFor(() => args.onPing(), { onTimeout: (error) => { expect(dialog).toBeVisible(); return error; } });',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title:
      'an interaction whose first following check is inside a step has no copy, as a step is no check statement and the later check is not copied in its place',
    source: inPlayWith(
      ['args', 'step', 'userEvent'],
      'await userEvent.click(open);',
      "await step('verify', async () => { await expect(dialog).toBeVisible(); });",
      'await expect(args.onOpen).toHaveBeenCalled();',
    ),
    expect: [{ checks: ['expect', 'expect'], end: 'none' }],
  },
  {
    title:
      'a negative first check is copied too, as it fails before an interaction that removes what it looks for',
    source: inPlay(
      'await userEvent.click(save);',
      "await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();",
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [
      {
        checks: ['expect not', 'expect'],
        end: 'none',
        copy: "await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();",
      },
    ],
  },
  {
    title:
      'a toHaveBeenCalledTimes(0) first check is copied too, as it fails before an interaction when a spy was called earlier',
    source: inPlay(
      'await userEvent.click(cancel);',
      'await expect(args.onSave).toHaveBeenCalledTimes(0);',
    ),
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'await expect(args.onSave).toHaveBeenCalledTimes(0);',
      },
    ],
  },
  {
    title:
      'an interaction whose first check reads a name declared after the interaction has no copy',
    source: inPlay(
      'await userEvent.click(open);',
      "const dialog = await canvas.findByRole('dialog');",
      'await expect(dialog).toBeVisible();',
    ),
    expect: [{ checks: ['query', 'expect'], end: 'none' }],
  },
  {
    title:
      'an interaction whose first check reads a name assigned after the interaction has no copy',
    source: inPlay(
      'let dialog;',
      'await userEvent.click(open);',
      "dialog = canvas.getByRole('dialog');",
      'await expect(dialog).toBeVisible();',
    ),
    expect: [{ checks: ['query', 'expect'], end: 'none' }],
  },
  {
    title:
      'the first check is copied when the name it reads is declared only after the check, as a function declaration is',
    source: inPlay(
      'await userEvent.click(add);',
      'await expect(canvas.getByText(itemCount(1))).toBeVisible();',
      'function itemCount(count) {',
      "  return count + ' item';",
      '}',
    ),
    expect: [
      {
        checks: ['expect', 'query'],
        end: 'none',
        copy: 'await expect(canvas.getByText(itemCount(1))).toBeVisible();',
      },
    ],
  },
  {
    title:
      'the first check is copied when the name it reads is a function declared between the interaction and the check, as hoisting declares it before the interaction',
    source: inPlay(
      'await userEvent.click(add);',
      'function itemCount(count) {',
      "  return count + ' item';",
      '}',
      'await expect(canvas.getByText(itemCount(1))).toBeVisible();',
    ),
    expect: [
      {
        checks: ['expect', 'query'],
        end: 'none',
        copy: 'await expect(canvas.getByText(itemCount(1))).toBeVisible();',
      },
    ],
  },
  {
    title:
      'an interaction whose first check calls a function that reads a name declared between the interaction and the check has no copy, as the copy would read it before its declaration',
    source: inPlay(
      'await userEvent.click(add);',
      "const label = '1 item';",
      'function shown() {',
      '  return canvas.getByText(label);',
      '}',
      'await expect(shown()).toBeVisible();',
    ),
    expect: [{ checks: ['query', 'expect'], end: 'none' }],
  },
  {
    title:
      'the first check is copied when it calls a function declared between that calls itself and reads only its own parameters',
    source: inPlay(
      'await userEvent.click(add);',
      'function count(n) {',
      '  return n === 0 ? 0 : count(n - 1) + 1;',
      '}',
      'await expect(canvas.getByText(String(count(1)))).toBeVisible();',
    ),
    expect: [
      {
        checks: ['expect', 'query'],
        end: 'none',
        copy: 'await expect(canvas.getByText(String(count(1)))).toBeVisible();',
      },
    ],
  },
  {
    title:
      'an interaction whose first check reads a name the interaction itself assigns has no copy',
    source: inPlay(
      'let input;',
      "await userEvent.click((input = canvas.getByRole('textbox')));",
      'await expect(input).toHaveFocus();',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title:
      'an interaction whose first check reads a name assigned right after the interaction, with nothing between the two statements, has no copy',
    source: inPlay(
      'let dialog;',
      "await userEvent.click(open);dialog = canvas.getByRole('dialog');",
      'await expect(dialog).toBeVisible();',
    ),
    expect: [{ checks: ['query', 'expect'], end: 'none' }],
  },
  {
    title:
      'an interaction whose first check also stands earlier in the play has no copy, as that check states an invariant',
    source: inPlay(
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await expect(canvas.getByRole('form')).toBeVisible();",
      'await userEvent.click(save);',
      "await expect(canvas.getByRole('form')).toBeVisible();",
    ),
    expect: [{ checks: ['expect', 'query'], end: 'none' }],
  },
  {
    title:
      'an interaction whose first check also stands right before it, with nothing between the two statements, has no copy',
    source: inPlay(
      'await expect(form).toBeVisible();await userEvent.click(save);',
      'await expect(form).toBeVisible();',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title:
      'an interaction whose first check, holding a template literal, also stands earlier in the play has no copy',
    source: inPlay(
      'await expect(status).toHaveTextContent(`Saved`);',
      'await userEvent.click(save);',
      'await expect(status).toHaveTextContent(`Saved`);',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title:
      "the first check is copied when the same check stands earlier only in another story's play",
    source: `export const Save = {\n  play: async ({ args, userEvent }) => {\n    await userEvent.click(save);\n    await expect(args.onSave).toHaveBeenCalled();\n  },\n};\nexport const SaveAndClose = {\n  play: async ({ args, userEvent }) => {\n    await userEvent.click(saveAndClose);\n    await expect(args.onSave).toHaveBeenCalled();\n  },\n};\n`,
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'await expect(args.onSave).toHaveBeenCalled();',
      },
      {
        checks: ['expect'],
        end: 'none',
        copy: 'await expect(args.onSave).toHaveBeenCalled();',
      },
    ],
  },
  {
    title:
      'an interaction followed by another interaction before any check has no copy; the last one before the check has one',
    source: inPlay(
      'await userEvent.click(first);',
      'await userEvent.click(second);',
      'await expect(args.onClick).toHaveBeenCalledTimes(2);',
    ),
    expect: [
      { checks: [], end: 'interaction sameList adjacent' },
      {
        checks: ['expect'],
        end: 'none',
        copy: 'await expect(args.onClick).toHaveBeenCalledTimes(2);',
      },
    ],
  },
  {
    title:
      'the copied check is the first one past a function that is only defined, even when the function holds an interaction',
    source: inPlay(
      'await userEvent.click(a);',
      'const later = async () => {',
      '  await userEvent.click(b);',
      '};',
      'await expect(dialog).toBeVisible();',
    ),
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'await expect(dialog).toBeVisible();',
      },
      { checks: [], end: 'none' },
    ],
  },
  {
    title:
      'the copied check is the first one past a function declaration, even when the function holds an interaction',
    source: inPlay(
      'await userEvent.click(a);',
      'async function later() {',
      '  await userEvent.click(b);',
      '}',
      'await expect(dialog).toBeVisible();',
    ),
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'await expect(dialog).toBeVisible();',
      },
      { checks: [], end: 'none' },
    ],
  },
  {
    title:
      'an interaction that is the body of an if without braces has no copy, as no check follows it in its own block',
    source: inPlay(
      'if (open) await userEvent.click(button);',
      'await expect(args.onClick).toHaveBeenCalled();',
    ),
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title:
      'an interaction has no copy when an if that holds another interaction stands before the next check, as that check is none of its following checks',
    source: inPlay(
      'await userEvent.click(first);',
      'if (open) {',
      '  await userEvent.click(second);',
      '}',
      'await expect(args.onClick).toHaveBeenCalled();',
    ),
    expect: [
      { checks: [], end: 'maybe' },
      { checks: ['expect'], end: 'none' },
    ],
  },
  {
    title:
      'an interaction has no copy when a waitFor whose callback holds another interaction stands before the next check, as that check is none of its following checks',
    source: inPlay(
      'await userEvent.click(first);',
      'await waitFor(async () => { await userEvent.click(second); });',
      'await expect(args.onClick).toHaveBeenCalled();',
    ),
    expect: [
      { checks: [], end: 'maybe' },
      { checks: [], end: 'none' },
    ],
  },
  {
    title:
      'an interaction has no copy when a step whose callback defines a function holding another interaction stands before the next check, as that check is none of its following checks',
    source: inPlayWith(
      ['args', 'step', 'userEvent'],
      'await userEvent.click(first);',
      "await step('Second', async () => {",
      '  const clickSecond = async () => {',
      '    await userEvent.click(second);',
      '  };',
      '  await clickSecond();',
      '});',
      'await expect(args.onClick).toHaveBeenCalled();',
    ),
    expect: [
      { checks: [], end: 'step' },
      { checks: [], end: 'none' },
    ],
  },
  {
    title:
      'the copied check is the first one past a call that is no step or waitFor, even when a function given to it holds an interaction',
    source: inPlay(
      'await userEvent.click(first);',
      'await run(async () => { await userEvent.click(second); });',
      'await expect(args.onClick).toHaveBeenCalled();',
    ),
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'await expect(args.onClick).toHaveBeenCalled();',
      },
      { checks: [], end: 'none' },
    ],
  },
  {
    title:
      'an interaction has no copy when an if that holds a step with another interaction stands before the next check, as that check is none of its following checks',
    source: inPlay(
      'await userEvent.click(first);',
      "if (open) { await step('Second', async () => { await userEvent.click(second); }); }",
      'await expect(args.onClick).toHaveBeenCalled();',
    ),
    expect: [
      { checks: [], end: 'maybe' },
      { checks: ['expect'], end: 'none' },
    ],
  },
  {
    title:
      'an interaction that is the expression body of a step has no copy, as no check follows it in its own block',
    source: `export const Story = {\n  play: async ({ args, step, userEvent }) => {\n    await step('Save', () => userEvent.click(save));\n    await expect(args.onSave).toHaveBeenCalled();\n  },\n};\n`,
    expect: [{ checks: ['expect'], end: 'none' }],
  },
  {
    title:
      'an interaction in a beforeEach has a copy like any other, as standing in a hook is a site rule of its own',
    source: `export const Story = {\n  beforeEach: async ({ userEvent }) => {\n    await userEvent.click(accept);\n    await expect(args.onAccept).toHaveBeenCalled();\n  },\n};\n`,
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'await expect(args.onAccept).toHaveBeenCalled();',
      },
    ],
  },
  {
    title:
      "the check after a click on the default member of a namespace import of '@testing-library/user-event' is copied to run before it too",
    source: `import * as ue from '@testing-library/user-event';\n${inPlay(
      'await ue.default.click(save);',
      'await expect(args.onSave).toHaveBeenCalled();',
    )}`,
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'await expect(args.onSave).toHaveBeenCalled();',
      },
    ],
  },
  {
    title:
      'an expect.soft check is the first check after an interaction, so it is the one copied',
    source: inPlay(
      'await userEvent.click(save);',
      "expect.soft(status).toHaveTextContent('Saved');",
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [
      {
        checks: ['expect', 'expect'],
        end: 'none',
        copy: "expect.soft(status).toHaveTextContent('Saved');",
      },
    ],
  },
  {
    title:
      'an expect.element check is the first check after an interaction, so it is the one copied',
    source: inPlay(
      'await userEvent.click(save);',
      "await expect.element(page.getByRole('dialog')).toBeVisible();",
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [
      {
        checks: ['expect', 'query', 'expect'],
        end: 'none',
        copy: "await expect.element(page.getByRole('dialog')).toBeVisible();",
      },
    ],
  },
  {
    title:
      'an expect.poll check is the first check after an interaction, so it is the one copied',
    source: inPlay(
      'await userEvent.click(save);',
      "await expect.poll(() => status.textContent).toBe('Saved');",
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [
      {
        checks: ['expect', 'expect'],
        end: 'none',
        copy: "await expect.poll(() => status.textContent).toBe('Saved');",
      },
    ],
  },
  {
    title:
      'an expect.assertions call is no check, so the copied check is the first one past it',
    source: inPlay(
      'await userEvent.click(save);',
      'expect.assertions(1);',
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'await expect(args.onSave).toHaveBeenCalled();',
      },
    ],
  },
  {
    title:
      "an expect['soft'] check is the first check after an interaction, so it is the one copied",
    source: inPlay(
      'await userEvent.click(save);',
      "expect['soft'](status).toHaveTextContent('Saved');",
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [
      {
        checks: ['expect', 'expect'],
        end: 'none',
        copy: "expect['soft'](status).toHaveTextContent('Saved');",
      },
    ],
  },
  {
    title:
      'an expect member under a computed key that is a name, not a string, is no check, so the copied check is the first one past it',
    source: inPlay(
      'await userEvent.click(save);',
      "expect[soft](status).toHaveTextContent('Saved');",
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [
      {
        checks: ['expect'],
        end: 'none',
        copy: 'await expect(args.onSave).toHaveBeenCalled();',
      },
    ],
  },
];

describe('interactionsOf following checks copy', () => {
  copyCases.forEach(({ title, source, expect }) => {
    it(title, () => {
      assert.deepEqual(followingIn(source), [expect, expect]);
    });
  });

  it('a name declared between the interaction and the check by a node without positions does not keep it from being copied', () => {
    const check = "expect(status).toHaveTextContent('Saved');";
    const source = inPlay(
      'await userEvent.click(save);',
      "const status = canvas.getByRole('status');",
      check,
    );

    assert.deepEqual(
      firstCopyWithout(
        source,
        (node) =>
          field(node, 'type') === 'Identifier' &&
          field(node, 'name') === 'status',
        'start',
      ),
      [check, check],
    );
  });

  it('a name declared between an interaction without positions and the check does not keep it from being copied', () => {
    const check = "expect(status).toHaveTextContent('Saved');";
    const source = inPlay(
      'await userEvent.click(save);',
      "const status = canvas.getByRole('status');",
      check,
    );

    assert.deepEqual(
      firstCopyWithout(
        source,
        (node) => field(node, 'type') === 'ExpressionStatement',
        'start',
      ),
      [check, check],
    );
  });

  it('a check statement without positions is copied though it reads a name declared between', () => {
    const source = inPlay(
      'await userEvent.click(save);',
      "const status = canvas.getByRole('status');",
      "expect(status).toHaveTextContent('Saved');",
    );

    assert.deepEqual(
      programsOf(source).map((program) => {
        const check = descendants(program).find(
          (node) =>
            field(node, 'type') === 'ExpressionStatement' &&
            field(node, 'expression', 'type') === 'CallExpression',
        );

        if (!isRecord(check)) {
          throw new Error('The source has no check statement.');
        }

        Reflect.deleteProperty(check, 'start');

        return (
          interactionsOf(program, csfShapes(program)).all[0]?.following.copy ===
          check
        );
      }),
      [true, true],
    );
  });

  it('a reader made before a placed mutant changes the tree still gives the copy of the file as written', () => {
    const check = 'expect(args.onSave).toHaveBeenCalled();';
    const source = inPlay('await userEvent.click(save);', check);

    assert.deepEqual(
      programsOf(source).map((program) => {
        const reader = interactionsOf(program, csfShapes(program));
        const [interaction] = reader.all;
        const statements = field(
          indexTree(program).parentOf(interaction?.node),
          'body',
        );

        if (!Array.isArray(statements)) {
          throw new Error('The interaction stands in no block.');
        }

        statements.splice(1, 1, {
          type: 'BlockStatement',
          body: [statements[1]],
          directives: [],
        });

        return textOf(source, reader.at(interaction?.node)?.following.copy);
      }),
      [check, check],
    );
  });

  it('an equivalent statement without positions before the interaction does not keep the check from being copied', () => {
    const check = "expect(canvas.getByRole('form')).toBeVisible();";
    const source = inPlay(check, 'await userEvent.click(save);', check);

    assert.deepEqual(
      firstCopyWithout(
        source,
        (node) => field(node, 'type') === 'ExpressionStatement',
        'end',
      ),
      [check, check],
    );
  });
});

/** The copy text of the first interaction of `source`, once per parse, after the first node that `isTarget` accepts loses its `key` position. */
function firstCopyWithout(
  source: string,
  isTarget: (node: unknown) => boolean,
  key: 'start' | 'end',
): readonly (string | undefined)[] {
  return programsOf(source).map((program) => {
    const target = descendants(program).find(isTarget);

    if (!isRecord(target)) {
      throw new Error('The source has no target node.');
    }

    Reflect.deleteProperty(target, key);

    return textOf(
      source,
      interactionsOf(program, csfShapes(program)).all[0]?.following.copy,
    );
  });
}
