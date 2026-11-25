import {
  inPlay,
  type InteractionHintCase,
} from './support/interaction-hint-case.ts';

const interaction = 'MuirProteusStorybookTestInteraction';

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
    id: 'cleared-twice',
    title:
      'names a surviving clear that the next interaction clears again with no check between them',
    source: inPlay(
      "await userEvent.clear(canvas.getByRole('textbox'));",
      "await userEvent.clear(canvas.getByRole('textbox'));",
    ),
    survived: [[interaction, 5]],
    expect: [[5, 'cleared-later', [interaction]]],
  },
  {
    id: 'typed-again',
    title:
      'gives no hint for a type that the next interaction types into again, as only a clear drops what it left',
    source: inPlay(
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      "await userEvent.type(canvas.getByRole('textbox'), 'Lovelace');",
    ),
    survived: [[interaction, 5]],
    expect: [],
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
