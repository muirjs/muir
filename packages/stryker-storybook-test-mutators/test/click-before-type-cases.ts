import { type Case, inPlay } from './support/case.ts';

const interaction = 'LzStorybookInteraction';

export const clickBeforeTypeCases: readonly Case[] = [
  {
    id: 'click-before-type',
    title:
      'a click directly before a type on the same target is removed, as is the type',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'a');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'hover-before-type',
    title:
      'a hover directly before a type on the same target is removed, as is the type',
    source: inPlay(
      'await userEvent.hover(input);',
      "await userEvent.type(input, 'a');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'optional-click-before-type',
    title:
      'a userEvent?.click directly before a userEvent?.type on the same target is removed, as is the type',
    source: inPlay(
      'await userEvent?.click(input);',
      "await userEvent?.type(input, 'a');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'click-before-type-elsewhere',
    title: 'a click directly before a type on another target is removed',
    source: inPlay(
      'await userEvent.click(button);',
      "await userEvent.type(input, 'a');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'hover-before-clear',
    title:
      'a hover directly before a clear on the same target is removed, as clear only focuses',
    source: inPlay(
      'await userEvent.hover(input);',
      'await userEvent.clear(input);',
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'click-before-clear',
    title:
      'a click directly before a clear on the same target is removed, as clear only focuses',
    source: inPlay(
      'await userEvent.click(input);',
      'await userEvent.clear(input);',
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'click-before-type-skip-click',
    title:
      'a click directly before a type of the same target with skipClick is removed, as that type does not click',
    source: inPlay(
      'await userEvent.click(input);',
      "await userEvent.type(input, 'a', { skipClick: true });",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'click-before-type-quoted-skip-click',
    title:
      "a click directly before a type of the same target with a quoted 'skipClick': true key is removed",
    source: inPlay(
      'await userEvent.click(input);',
      "await userEvent.type(input, 'a', { 'skipClick': true });",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'click-before-type-skip-click-among-options',
    title:
      'a click directly before a type of the same target with skipClick among other options is removed',
    source: inPlay(
      'await userEvent.click(input);',
      "await userEvent.type(input, 'a', { delay: 10, skipClick: true });",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'click-before-type-skip-click-variable',
    title:
      'a click directly before a type of the same target with a skipClick that is no literal is removed, as that type may not click',
    source: inPlay(
      'await userEvent.click(input);',
      "await userEvent.type(input, 'a', { skipClick: skip });",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'click-before-type-skip-click-false',
    title:
      'a click directly before a type of the same target with skipClick: false is removed',
    source: inPlay(
      'await userEvent.click(input);',
      "await userEvent.type(input, 'a', { skipClick: false });",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'click-before-type-other-options',
    title:
      'a click directly before a type of the same target with options but no skipClick is removed',
    source: inPlay(
      'await userEvent.click(input);',
      "await userEvent.type(input, 'a', { delay: 10 });",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
];
