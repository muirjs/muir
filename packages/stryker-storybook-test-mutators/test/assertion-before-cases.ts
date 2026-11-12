import { type Case, inPlay } from './support/case.ts';

const assertionBefore = 'LzStorybookAssertionBefore';

export const assertionBeforeCases: readonly Case[] = [
  {
    id: 'assertion-before-click',
    title:
      'the check after an interaction is copied to run before the interaction too',
    source: inPlay(
      'await userEvent.click(save);',
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [
      [
        assertionBefore,
        '{ await expect(args.onSave).toHaveBeenCalled(); await userEvent.click(save); }',
      ],
    ],
  },
  {
    id: 'assertion-before-first-check',
    title:
      'the copied check is the first expect statement after the interaction, past statements that check nothing',
    source: inPlay(
      'await userEvent.click(save);',
      'await sleep(10);',
      "await expect(canvas.getByRole('status')).toHaveTextContent('Saved');",
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [
      [
        assertionBefore,
        "{ await expect(canvas.getByRole('status')).toHaveTextContent('Saved'); await userEvent.click(save); }",
      ],
    ],
  },
  {
    id: 'assertion-before-skip-wait-for',
    title:
      'an interaction whose first check is inside a waitFor makes no mutant, as the copy would wait and then fail',
    source: inPlay(
      'await userEvent.click(open);',
      "await waitFor(() => expect(canvas.getByRole('dialog')).toBeVisible());",
    ),
    expect: [],
  },
  {
    id: 'assertion-before-skip-negative',
    title:
      'an interaction whose first check is negative makes no mutant, as a negative check mostly holds before too',
    source: inPlay(
      'await userEvent.click(save);',
      "await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();",
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [],
  },
  {
    id: 'assertion-before-skip-called-zero-times',
    title:
      'an interaction whose first check is toHaveBeenCalledTimes(0) makes no mutant, as a fresh spy passes it',
    source: inPlay(
      'await userEvent.click(cancel);',
      'await expect(args.onSave).toHaveBeenCalledTimes(0);',
    ),
    expect: [],
  },
  {
    id: 'assertion-before-to-have-length-zero',
    title:
      'the first check after an interaction is copied when it expects a 0 from a matcher other than toHaveBeenCalledTimes',
    source: inPlay(
      'await userEvent.click(dismiss);',
      "await expect(canvas.queryAllByRole('alert')).toHaveLength(0);",
    ),
    expect: [
      [
        assertionBefore,
        "{ await expect(canvas.queryAllByRole('alert')).toHaveLength(0); await userEvent.click(dismiss); }",
      ],
    ],
  },
  {
    id: 'assertion-before-skip-nested-negative',
    title:
      'an interaction whose first check holds a negative check inside a positive one makes no mutant',
    source: inPlay(
      'await userEvent.click(save);',
      'await expect(dialog).toSatisfy(() => expect(args.onSave).not.toHaveBeenCalled());',
    ),
    expect: [],
  },
  {
    id: 'assertion-before-skip-nested-called-zero-times',
    title:
      'an interaction whose first check holds a toHaveBeenCalledTimes(0) check inside another check makes no mutant',
    source: inPlay(
      'await userEvent.click(cancel);',
      'await expect(dialog).toSatisfy(() => expect(args.onSave).toHaveBeenCalledTimes(0));',
    ),
    expect: [],
  },
  {
    id: 'assertion-before-uncalled-matcher',
    title:
      'a toHaveBeenCalledTimes matcher that a check passes on rather than calls takes no count, so the check is copied',
    source: inPlay(
      'await userEvent.click(cancel);',
      'await expect(times(0, expect(args.onSave).toHaveBeenCalledTimes)).toBeUndefined();',
    ),
    expect: [
      [
        assertionBefore,
        '{ await expect(times(0, expect(args.onSave).toHaveBeenCalledTimes)).toBeUndefined(); await userEvent.click(cancel); }',
      ],
    ],
  },
  {
    id: 'assertion-before-skip-later-binding',
    title:
      'an interaction whose first check reads a name declared after the interaction makes no mutant',
    source: inPlay(
      'await userEvent.click(open);',
      "const dialog = await canvas.findByRole('dialog');",
      'await expect(dialog).toBeVisible();',
    ),
    expect: [],
  },
  {
    id: 'assertion-before-skip-later-assignment',
    title:
      'an interaction whose first check reads a name assigned after the interaction makes no mutant',
    source: inPlay(
      'let dialog;',
      'await userEvent.click(open);',
      "dialog = canvas.getByRole('dialog');",
      'await expect(dialog).toBeVisible();',
    ),
    expect: [],
  },
  {
    id: 'assertion-before-skip-repeated-check',
    title:
      'an interaction whose first check also stands earlier in the play makes no mutant, as that check states an invariant',
    source: inPlay(
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await expect(canvas.getByRole('form')).toBeVisible();",
      'await userEvent.click(save);',
      "await expect(canvas.getByRole('form')).toBeVisible();",
    ),
    expect: [],
  },
  {
    id: 'assertion-before-next-interaction',
    title:
      'an interaction followed by another interaction before any check makes no mutant; the last one before the check makes one',
    source: inPlay(
      'await userEvent.click(first);',
      'await userEvent.click(second);',
      'await expect(args.onClick).toHaveBeenCalledTimes(2);',
    ),
    expect: [
      [
        assertionBefore,
        '{ await expect(args.onClick).toHaveBeenCalledTimes(2); await userEvent.click(second); }',
      ],
    ],
  },
  {
    id: 'assertion-before-past-function-with-interaction',
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
      [
        assertionBefore,
        '{ await expect(dialog).toBeVisible(); await userEvent.click(a); }',
      ],
    ],
  },
  {
    id: 'assertion-before-past-function-declaration-with-interaction',
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
      [
        assertionBefore,
        '{ await expect(dialog).toBeVisible(); await userEvent.click(a); }',
      ],
    ],
  },
  {
    id: 'assertion-before-skip-step-body',
    title:
      'an interaction that is the expression body of a step makes no mutant, as no check follows it in its own block',
    source: `export const Story = {\n  play: async ({ args, step, userEvent }) => {\n    await step('Save', () => userEvent.click(save));\n    await expect(args.onSave).toHaveBeenCalled();\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'assertion-before-skip-before-each',
    title: 'an interaction in a beforeEach makes no mutant',
    source: `export const Story = {\n  beforeEach: async ({ userEvent }) => {\n    await userEvent.click(accept);\n    await expect(args.onAccept).toHaveBeenCalled();\n  },\n};\n`,
    expect: [],
  },
];
