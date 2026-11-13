import {
  inPlay,
  type InteractionHintCase,
} from './support/interaction-hint-case.ts';

const interaction = 'LzStorybookInteraction';

export const clickBeforeTypeHintCases: readonly InteractionHintCase[] = [
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
    id: 'type-options-variable',
    title:
      'gives no hint for a click before a type whose options come from a variable, which may skip the click',
    source: inPlay(
      'const options = { skipClick: true };',
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada', options);",
    ),
    survived: [[interaction, 6]],
    expect: [],
  },
  {
    id: 'type-options-spread',
    title:
      'gives no hint for a click before a type whose options hold a spread, which may skip the click',
    source: inPlay(
      'const options = { skipClick: true };',
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada', { delay: 0, ...options });",
    ),
    survived: [[interaction, 6]],
    expect: [],
  },
  {
    id: 'type-skips-click-quoted',
    title:
      'gives no hint for a click before a type given a quoted skipClick key, which does not click',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada', { 'skipClick': true });",
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'type-options-computed-key',
    title:
      'gives no hint for a click before a type whose options have a computed key, which may be skipClick',
    source: inPlay(
      "const option = 'skipClick';",
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada', { [option]: true });",
    ),
    survived: [[interaction, 6]],
    expect: [],
  },
  {
    id: 'type-options-getter',
    title:
      'gives no hint for a click before a type whose options have a skipClick getter, which may skip the click',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada', { get skipClick() { return true; } });",
    ),
    survived: [[interaction, 5]],
    expect: [],
  },
  {
    id: 'type-options-proto',
    title:
      'gives no hint for a click before a type whose options set a prototype, which may hold skipClick',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada', { __proto__: { skipClick: true } });",
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
];
