import {
  inPlay,
  type InteractionHintCase,
} from './support/interaction-hint-case.ts';

const interaction = 'LzStorybookInteraction';

export const hintLineCases: readonly InteractionHintCase[] = [
  {
    id: 'two-hints',
    title:
      'names a click before a type and the type that the next interaction clears, one hint each',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      "await userEvent.clear(canvas.getByRole('textbox'));",
    ),
    survived: [
      [interaction, 5],
      [interaction, 6],
    ],
    expect: [
      [5, 'click-before-type', [interaction]],
      [6, 'cleared-later', [interaction]],
    ],
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
    id: 'nested-interaction',
    title:
      'names a survivor by the innermost interaction around it, not by an interaction whose argument holds that one',
    source: inPlay(
      'await userEvent.click(',
      '  await (async () => {',
      "    await userEvent.click(canvas.getByRole('button'));",
      '    await expect(args.onSave).not.toHaveBeenCalled();',
      '  })(),',
      ');',
    ),
    survived: [[interaction, 7]],
    expect: [[7, 'negative-only', [interaction]]],
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
  {
    id: 'shared-line-killed-mutant',
    title:
      'gives no hint when a mutant of the surviving mutator on the same line was killed, as the comment would disable it too',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button')); await expect(args.onSave).not.toHaveBeenCalled(); await userEvent.click(canvas.getByRole('checkbox')); await expect(args.onChange).not.toHaveBeenCalled();",
    ),
    survived: [[interaction, 5, 5]],
    expect: [],
  },
  {
    id: 'shared-line-every-mutant-survives',
    title:
      'names the mutator when every mutant of it on the line survived with the same shape',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button')); await expect(args.onSave).not.toHaveBeenCalled(); await userEvent.click(canvas.getByRole('checkbox')); await expect(args.onChange).not.toHaveBeenCalled();",
    ),
    survived: [[interaction, 5]],
    expect: [[5, 'negative-only', [interaction]]],
  },
];
