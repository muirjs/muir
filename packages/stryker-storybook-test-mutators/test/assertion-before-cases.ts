import { type Case, inPlay, inPlayWith } from './support/case.ts';

const assertionBefore = 'LzStorybookAssertionBefore';

// The expect methods that start a check, each with a check statement.
const expectMethodChecks: readonly (readonly [string, string])[] = [
  ['soft', "expect.soft(status).toHaveTextContent('Saved');"],
  ['element', "await expect.element(page.getByRole('dialog')).toBeVisible();"],
  ['poll', "await expect.poll(() => status.textContent).toBe('Saved');"],
];

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
      'the copied check is the first check statement after the interaction, past statements that check nothing',
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
    id: 'assertion-before-wait-for',
    title:
      'a waitFor that holds the first check is copied, as the copy fails when its check does not hold before the interaction',
    source: inPlay(
      'await userEvent.click(open);',
      "await waitFor(() => expect(canvas.getByRole('dialog')).toBeVisible());",
    ),
    expect: [
      [
        assertionBefore,
        "{ await waitFor(() => expect(canvas.getByRole('dialog')).toBeVisible()); await userEvent.click(open); }",
      ],
    ],
  },
  {
    id: 'assertion-before-wait-for-not-awaited',
    title:
      'a waitFor that is not awaited and holds the first check is copied as written',
    source: inPlay(
      'await userEvent.click(open);',
      'waitFor(() => expect(dialog).toBeVisible());',
    ),
    expect: [
      [
        assertionBefore,
        '{ waitFor(() => expect(dialog).toBeVisible()); await userEvent.click(open); }',
      ],
    ],
  },
  {
    id: 'assertion-before-skip-wait-for-check-outside-callback',
    title:
      'an interaction whose first check is in a waitFor argument other than its callback makes no mutant, as the copy would run the callback before the interaction and check nothing',
    source: inPlay(
      'await userEvent.click(open);',
      'await waitFor(() => args.onPing(), { onTimeout: (error) => { expect(dialog).toBeVisible(); return error; } });',
    ),
    expect: [],
  },
  {
    id: 'assertion-before-skip-step-holding-check',
    title:
      'an interaction whose first check is inside a step makes no mutant, as a copy of the step would run its other effects twice',
    source: inPlayWith(
      ['args', 'step', 'userEvent'],
      'await userEvent.click(open);',
      "await step('verify', async () => { await expect(dialog).toBeVisible(); });",
      'await expect(args.onOpen).toHaveBeenCalled();',
    ),
    expect: [],
  },
  {
    id: 'assertion-before-negative',
    title:
      'a negative first check is copied too, as it fails before an interaction that removes what it looks for',
    source: inPlay(
      'await userEvent.click(save);',
      "await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();",
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [
      [
        assertionBefore,
        "{ await expect(canvas.queryByRole('alert')).not.toBeInTheDocument(); await userEvent.click(save); }",
      ],
    ],
  },
  {
    id: 'assertion-before-called-zero-times',
    title:
      'a toHaveBeenCalledTimes(0) first check is copied too, as it fails before an interaction when a spy was called earlier',
    source: inPlay(
      'await userEvent.click(cancel);',
      'await expect(args.onSave).toHaveBeenCalledTimes(0);',
    ),
    expect: [
      [
        assertionBefore,
        '{ await expect(args.onSave).toHaveBeenCalledTimes(0); await userEvent.click(cancel); }',
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
    id: 'assertion-before-name-declared-after-check',
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
      [
        assertionBefore,
        '{ await expect(canvas.getByText(itemCount(1))).toBeVisible(); await userEvent.click(add); }',
      ],
    ],
  },
  {
    id: 'assertion-before-skip-assignment-right-after',
    title:
      'an interaction whose first check reads a name assigned right after the interaction, with nothing between the two statements, makes no mutant',
    source: inPlay(
      'let dialog;',
      "await userEvent.click(open);dialog = canvas.getByRole('dialog');",
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
    id: 'assertion-before-skip-check-ending-at-interaction',
    title:
      'an interaction whose first check also stands right before it, with nothing between the two statements, makes no mutant',
    source: inPlay(
      'await expect(form).toBeVisible();await userEvent.click(save);',
      'await expect(form).toBeVisible();',
    ),
    expect: [],
  },
  {
    id: 'assertion-before-same-check-in-other-story',
    title:
      "the first check is copied when the same check stands earlier only in another story's play",
    source: `export const Save = {\n  play: async ({ args, userEvent }) => {\n    await userEvent.click(save);\n    await expect(args.onSave).toHaveBeenCalled();\n  },\n};\nexport const SaveAndClose = {\n  play: async ({ args, userEvent }) => {\n    await userEvent.click(saveAndClose);\n    await expect(args.onSave).toHaveBeenCalled();\n  },\n};\n`,
    expect: [
      [
        assertionBefore,
        '{ await expect(args.onSave).toHaveBeenCalled(); await userEvent.click(save); }',
      ],
      [
        assertionBefore,
        '{ await expect(args.onSave).toHaveBeenCalled(); await userEvent.click(saveAndClose); }',
      ],
    ],
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
    id: 'assertion-before-skip-braceless-if-body',
    title:
      'an interaction that is the body of an if without braces makes no mutant, as no check follows it in its own block',
    source: inPlay(
      'if (open) await userEvent.click(button);',
      'await expect(args.onClick).toHaveBeenCalled();',
    ),
    expect: [],
  },
  {
    id: 'assertion-before-skip-past-if-with-interaction',
    title:
      'an interaction makes no mutant when an if that holds another interaction stands before the next check, as that check is none of its following checks',
    source: inPlay(
      'await userEvent.click(first);',
      'if (open) {',
      '  await userEvent.click(second);',
      '}',
      'await expect(args.onClick).toHaveBeenCalled();',
    ),
    expect: [],
  },
  {
    id: 'assertion-before-skip-past-wait-for-with-interaction',
    title:
      'an interaction makes no mutant when a waitFor whose callback holds another interaction stands before the next check, as that check is none of its following checks',
    source: inPlay(
      'await userEvent.click(first);',
      'await waitFor(async () => { await userEvent.click(second); });',
      'await expect(args.onClick).toHaveBeenCalled();',
    ),
    expect: [],
  },
  {
    id: 'assertion-before-skip-past-step-defining-interaction',
    title:
      'an interaction makes no mutant when a step whose callback defines a function holding another interaction stands before the next check, as that check is none of its following checks',
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
    expect: [],
  },
  {
    id: 'assertion-before-past-call-with-interaction',
    title:
      'the copied check is the first one past a call that is no step or waitFor, even when a function given to it holds an interaction',
    source: inPlay(
      'await userEvent.click(first);',
      'await run(async () => { await userEvent.click(second); });',
      'await expect(args.onClick).toHaveBeenCalled();',
    ),
    expect: [
      [
        assertionBefore,
        '{ await expect(args.onClick).toHaveBeenCalled(); await userEvent.click(first); }',
      ],
    ],
  },
  {
    id: 'assertion-before-skip-past-if-with-step',
    title:
      'an interaction makes no mutant when an if that holds a step with another interaction stands before the next check, as that check is none of its following checks',
    source: inPlay(
      'await userEvent.click(first);',
      "if (open) { await step('Second', async () => { await userEvent.click(second); }); }",
      'await expect(args.onClick).toHaveBeenCalled();',
    ),
    expect: [],
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
  {
    id: 'assertion-before-namespace-default',
    title:
      "the check after a click on the default member of a namespace import of '@testing-library/user-event' is copied to run before it too",
    source: `import * as ue from '@testing-library/user-event';\n${inPlay(
      'await ue.default.click(save);',
      'await expect(args.onSave).toHaveBeenCalled();',
    )}`,
    expect: [
      [
        assertionBefore,
        '{ await expect(args.onSave).toHaveBeenCalled(); await ue.default.click(save); }',
      ],
    ],
  },
  ...expectMethodChecks.map(([method, check]) => ({
    id: `assertion-before-expect-${method}`,
    title: `an expect.${method} check is the first check after an interaction, so it is the one copied`,
    source: inPlay(
      'await userEvent.click(save);',
      check,
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [
      [assertionBefore, `{ ${check} await userEvent.click(save); }`] as const,
    ],
  })),
  {
    id: 'assertion-before-past-expect-assertions',
    title:
      'an expect.assertions call is no check, so the copied check is the first one past it',
    source: inPlay(
      'await userEvent.click(save);',
      'expect.assertions(1);',
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
    id: 'assertion-before-expect-soft-string-key',
    title:
      "an expect['soft'] check is the first check after an interaction, so it is the one copied",
    source: inPlay(
      'await userEvent.click(save);',
      "expect['soft'](status).toHaveTextContent('Saved');",
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [
      [
        assertionBefore,
        "{ expect['soft'](status).toHaveTextContent('Saved'); await userEvent.click(save); }",
      ],
    ],
  },
  {
    id: 'assertion-before-past-computed-expect-member',
    title:
      'an expect member under a computed key that is a name, not a string, is no check, so the copied check is the first one past it',
    source: inPlay(
      'await userEvent.click(save);',
      "expect[soft](status).toHaveTextContent('Saved');",
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [
      [
        assertionBefore,
        '{ await expect(args.onSave).toHaveBeenCalled(); await userEvent.click(save); }',
      ],
    ],
  },
];
