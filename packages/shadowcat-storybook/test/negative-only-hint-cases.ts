import {
  inPlay,
  type InteractionHintCase,
} from './support/interaction-hint-case.ts';

const interaction = 'MuirProteusStorybookTestInteraction';

export const negativeOnlyHintCases: readonly InteractionHintCase[] = [
  {
    id: 'negative-only',
    title:
      'names a surviving MuirProteusStorybookTestInteraction mutant whose following checks are all negative',
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
    id: 'positive-find-all-by',
    title:
      'gives no hint for an interaction followed by a findAllBy query, which fails when nothing is found',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await canvas.findAllByRole('row');",
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'positive-get-by',
    title:
      'gives no hint for an interaction followed by a getBy query statement, which throws when nothing is found',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "canvas.getByRole('dialog');",
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'positive-destructured-find-by',
    title:
      'gives no hint for an interaction followed by a findBy query destructured from canvas',
    source: inPlay(
      'const { findByText } = canvas;',
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await findByText('Saved');",
    ),
    survived: [[interaction, 6]],
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
    id: 'negative-asymmetric-matcher',
    title:
      'names a surviving interaction whose only check is negative with an asymmetric matcher, which is no check of its own',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalledWith(expect.anything());',
    ),
    survived: [[interaction, 5]],
    expect: [[5, 'negative-only', [interaction]]],
  },
  {
    id: 'positive-asymmetric-matcher',
    title:
      'gives no hint for an interaction whose negative check is followed by a positive one with an asymmetric matcher',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalledWith(expect.anything());',
      'await expect(args.onSubmit).toHaveBeenCalledWith(expect.anything());',
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'negative-past-expect-assertions',
    title:
      'names a surviving interaction followed by expect.assertions and a negative check with expect.objectContaining, neither of which is a positive check',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'expect.assertions(1);',
      'await expect(args.onSave).not.toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));',
    ),
    survived: [[interaction, 5]],
    expect: [[5, 'negative-only', [interaction]]],
  },
  {
    id: 'negative-after-conditional-interaction',
    title:
      'gives no hint when the negative checks run past an if that may or may not interact, and names the interaction in the if, whose own checks are all negative',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "if (args.open) { await userEvent.click(canvas.getByRole('checkbox')); }",
      'await expect(args.onClose).not.toHaveBeenCalled();',
    ),
    survived: [
      [interaction, 5],
      [interaction, 7],
    ],
    expect: [[7, 'negative-only', [interaction]]],
  },
  {
    id: 'negative-past-function-declaration',
    title:
      'names a surviving interaction whose negative checks run past a function declaration that holds an interaction, as declaring a function runs nothing',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'function openMenu() { userEvent.click(menu); }',
      'await expect(args.onSave).not.toHaveBeenCalled();',
    ),
    survived: [
      [interaction, 5],
      [interaction, 6],
    ],
    expect: [[5, 'negative-only', [interaction]]],
  },
];
