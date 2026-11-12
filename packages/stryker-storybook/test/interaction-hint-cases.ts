import type { InteractionShape } from '../src/interaction-hints.ts';

export interface InteractionHintCase {
  readonly id: string;
  readonly title: string;
  /** A story file. */
  readonly source: string;
  /** The mutants that survive, as [mutator name, 1-based line]; every other mutant is Killed, or Ignored when Stryker ignores it. */
  readonly survived: readonly (readonly [string, number])[];
  /** The hints, as [line, shape, mutator names]. */
  readonly expect: readonly (readonly [
    number,
    InteractionShape,
    readonly string[],
  ])[];
}

/** The first statement is on line 5. */
export function inPlay(...statements: readonly string[]): string {
  return [
    "export default { title: 'Form' };",
    '',
    'export const Form = {',
    '  play: async ({ args, canvas, step, userEvent }) => {',
    ...statements.map((statement) => `    ${statement}`),
    '  },',
    '};',
    '',
  ].join('\n');
}

const interaction = 'LzStorybookInteraction';

export const interactionHintCases: readonly InteractionHintCase[] = [
  {
    id: 'negative-only',
    title:
      'names a surviving LzStorybookInteraction mutant whose following checks are all negative',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button', { name: 'Save' }));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
    ),
    survived: [[interaction, 5]],
    expect: [[5, 'negative-only', [interaction]]],
  },
  {
    id: 'no-check',
    title: 'gives no hint for an interaction with no following check',
    source: inPlay("await userEvent.click(canvas.getByRole('button'));"),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'negative-and-positive',
    title:
      'gives no hint for an interaction whose following checks include a positive one',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await expect(canvas.getByRole('status')).toBeVisible();",
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'positive-soft-check',
    title:
      'gives no hint for an interaction whose following checks include a positive expect.soft one',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await expect.soft(canvas.getByRole('status')).toBeVisible();",
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'positive-element-check',
    title:
      'gives no hint for an interaction whose following checks include a positive expect.element one',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await expect.element(canvas.getByRole('status')).toBeVisible();",
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'positive-poll-check',
    title:
      'gives no hint for an interaction whose following checks include a positive expect.poll one',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await expect.poll(() => canvas.getByRole('status')).toBeVisible();",
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'positive-find-by',
    title:
      'gives no hint for an interaction followed by a findBy query, which fails when nothing is found',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await canvas.findByRole('dialog');",
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'ends-at-next-interaction',
    title:
      'reads the following checks only up to the next interaction, whose own checks may be positive',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await userEvent.click(canvas.getByRole('checkbox'));",
      'await expect(args.onChange).toHaveBeenCalled();',
    ),
    survived: [[interaction, 5]],
    expect: [[5, 'negative-only', [interaction]]],
  },
  {
    id: 'past-step-callback',
    title:
      'reads the following checks past the end of a step callback that holds the interaction',
    source: inPlay(
      "await step('save', async () => { await userEvent.click(canvas.getByRole('button')); });",
      'await expect(args.onSave).not.toHaveBeenCalled();',
    ),
    survived: [[interaction, 5]],
    expect: [[5, 'negative-only', [interaction]]],
  },
  {
    id: 'check-after-if-with-interaction',
    title:
      'gives no hint when the only check comes after an if that holds an interaction, which ends the following checks',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      "if (args.open) { await userEvent.click(canvas.getByRole('checkbox')); }",
      'await expect(args.onSave).not.toHaveBeenCalled();',
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'positive-check-after-if-with-interaction',
    title:
      'gives no hint when a positive check follows an if that holds an interaction, as the checks before the next interaction run past it',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "if (args.open) { await userEvent.click(canvas.getByRole('checkbox')); }",
      "await expect(canvas.getByRole('status')).toBeVisible();",
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'click-before-type',
    title:
      'names a surviving click directly before a type of the same target, quoted differently',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      'await userEvent.type(canvas.getByRole("textbox"), \'Ada\');',
    ),
    survived: [[interaction, 5]],
    expect: [[5, 'click-before-type', [interaction]]],
  },
  {
    id: 'hover-before-type',
    title: 'names a surviving hover directly before a type of the same target',
    source: inPlay(
      "await userEvent.hover(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    survived: [[interaction, 5]],
    expect: [[5, 'click-before-type', [interaction]]],
  },
  {
    id: 'click-before-type-elsewhere',
    title: 'gives no hint for a click before a type of another target',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'type-skips-click',
    title:
      'gives no hint for a click before a type given skipClick, which does not click',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada', { skipClick: true });",
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'type-keeps-click',
    title:
      'names a surviving click before a type given skipClick: false, which clicks',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada', { skipClick: false });",
    ),
    survived: [[interaction, 5]],
    expect: [[5, 'click-before-type', [interaction]]],
  },
  {
    id: 'vitest-browser-type',
    title:
      "gives no hint for a click before a type on Vitest browser's userEvent, whose type does not click",
    source: [
      "import { userEvent } from 'vitest/browser';",
      "export default { title: 'Form' };",
      'export const Form = {',
      '  play: async ({ canvas }) => {',
      "    await userEvent.click(canvas.getByRole('textbox'));",
      "    await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      '  },',
      '};',
      '',
    ].join('\n'),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'storybook-test-type',
    title:
      "names a surviving click before a type on storybook/test's userEvent, which is user-event 14",
    source: [
      "import { userEvent } from 'storybook/test';",
      "export default { title: 'Form' };",
      'export const Form = {',
      '  play: async ({ canvas }) => {',
      "    await userEvent.click(canvas.getByRole('textbox'));",
      "    await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      '  },',
      '};',
      '',
    ].join('\n'),
    survived: [[interaction, 5]],
    expect: [[5, 'click-before-type', [interaction]]],
  },
  {
    id: 'vitest-browser-import-expression-type',
    title:
      "gives no hint for a click before a type on Vitest browser's userEvent from an import expression",
    source: inPlay(
      "const { userEvent: ue } = await import('vitest/browser');",
      "await ue.click(canvas.getByRole('textbox'));",
      "await ue.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    survived: [[interaction, 6]],
    expect: [],
  },
  {
    id: 'vitest-browser-import-expression-shadows-context',
    title:
      "gives no hint for a click before a type on Vitest browser's userEvent from an import expression that shadows the play context's",
    source: inPlay(
      "await step('fill', async () => {",
      "  const { userEvent } = await import('vitest/browser');",
      "  await userEvent.click(canvas.getByRole('textbox'));",
      "  await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      '});',
    ),
    survived: [[interaction, 7]],
    expect: [],
  },
  {
    id: 'vitest-browser-setup-type',
    title:
      "gives no hint for a click before a type on a setup() local of Vitest browser's userEvent",
    source: [
      "import { userEvent } from 'vitest/browser';",
      "export default { title: 'Form' };",
      'export const Form = {',
      '  play: async ({ canvas }) => {',
      '    const user = userEvent.setup();',
      "    await user.click(canvas.getByRole('textbox'));",
      "    await user.type(canvas.getByRole('textbox'), 'Ada');",
      '  },',
      '};',
      '',
    ].join('\n'),
    survived: [[interaction, 6]],
    expect: [],
  },
  {
    id: 'fire-event-click-before-type',
    title:
      'gives no hint for a fireEvent click before a type, as the type repeats only a user-event click',
    source: inPlay(
      "await fireEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'cleared-later',
    title:
      'names a surviving type that the next interaction clears with no check between them',
    source: inPlay(
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      "await userEvent.clear(canvas.getByRole('textbox'));",
    ),
    survived: [[interaction, 5]],
    expect: [[5, 'cleared-later', [interaction]]],
  },
  {
    id: 'checked-before-clear',
    title: 'gives no hint for a type that a check reads before the clear',
    source: inPlay(
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      "await expect(canvas.getByRole('textbox')).toHaveValue('Ada');",
      "await userEvent.clear(canvas.getByRole('textbox'));",
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'several-mutators',
    title:
      'names every interaction mutator that survived on the line in one hint',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
    ),
    survived: [
      [interaction, 5],
      ['LzStorybookClickFocus', 5],
      ['LzStorybookInteractionRepeat', 5],
    ],
    expect: [
      [
        5,
        'negative-only',
        [interaction, 'LzStorybookClickFocus', 'LzStorybookInteractionRepeat'],
      ],
    ],
  },
  {
    id: 'target-on-later-line',
    title:
      "names a surviving LzStorybookInteractionTarget mutant on the line of its literal, below the interaction's first line",
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button', { name: 'Open' }));",
      'await userEvent.click(',
      "  canvas.getByRole('button', { name: 'Save' }),",
      ');',
      'await expect(args.onSave).not.toHaveBeenCalled();',
    ),
    survived: [['LzStorybookInteractionTarget', 7]],
    expect: [[7, 'negative-only', ['LzStorybookInteractionTarget']]],
  },
  {
    id: 'shared-line',
    title:
      'leaves a mutator out of the comment when a mutant of it on the same line has no shape',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox')); await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    survived: [
      [interaction, 5],
      ['LzStorybookInteractionRepeat', 5],
    ],
    expect: [[5, 'click-before-type', ['LzStorybookInteractionRepeat']]],
  },
  {
    id: 'shared-line-no-name-left',
    title:
      'gives no hint when every surviving mutator on the line also has a mutant there with no shape',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox')); await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
];
