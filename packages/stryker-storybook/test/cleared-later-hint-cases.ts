import {
  inPlay,
  type InteractionHintCase,
} from './support/interaction-hint-case.ts';

const interaction = 'LzStorybookInteraction';

export const clearedLaterHintCases: readonly InteractionHintCase[] = [
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
];
