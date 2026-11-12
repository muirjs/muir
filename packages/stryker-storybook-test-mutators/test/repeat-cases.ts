import { type Case, inPlay } from './support/case.ts';

const repeat = 'LzStorybookInteractionRepeat';

export const repeatCases: readonly Case[] = [
  {
    id: 'repeat-click',
    title: 'an awaited userEvent.click statement runs twice',
    source: inPlay('await userEvent.click(button);'),
    expect: [
      [
        repeat,
        '{ await userEvent.click(button); await userEvent.click(button); }',
      ],
    ],
  },
  {
    id: 'repeat-keyboard',
    title: 'a userEvent.keyboard press runs twice',
    source: inPlay("await userEvent.keyboard('{ArrowDown}');"),
    expect: [
      [
        repeat,
        "{ await userEvent.keyboard('{ArrowDown}'); await userEvent.keyboard('{ArrowDown}'); }",
      ],
    ],
  },
  {
    id: 'repeat-fire-event-click',
    title: 'a fireEvent.click statement runs twice',
    source: inPlay('await fireEvent.click(button);'),
    expect: [
      [
        repeat,
        '{ await fireEvent.click(button); await fireEvent.click(button); }',
      ],
    ],
  },
  {
    id: 'repeat-fire-event-in-type-assertion',
    title: 'a fireEvent.click on fireEvent inside an as expression runs twice',
    source: inPlay('await (fireEvent as any).click(button);'),
    expect: [
      [
        repeat,
        '{ await (fireEvent as any).click(button); await (fireEvent as any).click(button); }',
      ],
    ],
  },
  {
    id: 'repeat-optional-call',
    title: 'a userEvent?.click statement runs twice',
    source: inPlay('await userEvent?.click(button);'),
    expect: [
      [
        repeat,
        '{ await userEvent?.click(button); await userEvent?.click(button); }',
      ],
    ],
  },
  {
    id: 'repeat-fire-event-optional-call',
    title: 'a fireEvent?.click statement runs twice',
    source: inPlay('await fireEvent?.click(button);'),
    expect: [
      [
        repeat,
        '{ await fireEvent?.click(button); await fireEvent?.click(button); }',
      ],
    ],
  },
  {
    id: 'repeat-dbl-click',
    title: 'a userEvent.dblClick statement runs twice',
    source: inPlay('await userEvent.dblClick(row);'),
    expect: [
      [
        repeat,
        '{ await userEvent.dblClick(row); await userEvent.dblClick(row); }',
      ],
    ],
  },
  {
    id: 'repeat-step-body',
    title:
      'a click that is the expression body of a step callback runs twice, in order, in an async arrow called in its place',
    source: `export const Story = {\n  play: async ({ step, userEvent }) => {\n    await step('Add', () => userEvent.click(button));\n  },\n};\n`,
    expect: [
      [
        repeat,
        '(async () => { await userEvent.click(button); await userEvent.click(button); })()',
      ],
    ],
  },
  {
    id: 'repeat-step-body-fire-event',
    title: 'a fireEvent.click that is the expression body of a step runs twice',
    source: `export const Story = {\n  play: async ({ step }) => {\n    await step('Add', () => fireEvent.click(button));\n  },\n};\n`,
    expect: [
      [
        repeat,
        '(async () => { await fireEvent.click(button); await fireEvent.click(button); })()',
      ],
    ],
  },
  {
    id: 'repeat-skip-fire-event-change',
    title: 'a fireEvent call other than click makes no mutant',
    source: inPlay(
      "await fireEvent.change(input, { target: { value: 'a' } });",
    ),
    expect: [],
  },
  {
    id: 'repeat-skip-home',
    title:
      'a {Home} press makes no mutant, as a second press goes where the first went',
    source: inPlay("await userEvent.keyboard('{Home}');"),
    expect: [],
  },
  {
    id: 'repeat-skip-end',
    title: 'an {End} press makes no mutant',
    source: inPlay("await userEvent.keyboard('{End}');"),
    expect: [],
  },
  {
    id: 'repeat-click-of-home-text',
    title:
      'the {Home} and {End} rule covers only keyboard, so a click given the text {Home} runs twice',
    source: inPlay("await userEvent.click('{Home}');"),
    expect: [
      [
        repeat,
        "{ await userEvent.click('{Home}'); await userEvent.click('{Home}'); }",
      ],
    ],
  },
  {
    id: 'repeat-keyboard-no-argument',
    title: 'a userEvent.keyboard press with no argument runs twice',
    source: inPlay('await userEvent.keyboard();'),
    expect: [
      [repeat, '{ await userEvent.keyboard(); await userEvent.keyboard(); }'],
    ],
  },
  {
    id: 'repeat-hover',
    title: 'a hover makes no mutant, as a second hover changes nothing',
    source: inPlay('await userEvent.hover(button);'),
    expect: [],
  },
  {
    id: 'repeat-click-before-type',
    title: 'a click directly before a type on the same target runs twice',
    source: inPlay(
      'await userEvent.click(input);',
      "await userEvent.type(input, 'a');",
    ),
    expect: [
      [
        repeat,
        '{ await userEvent.click(input); await userEvent.click(input); }',
      ],
    ],
  },
  {
    id: 'repeat-negative-only',
    title: 'a click whose following checks are all negative checks runs twice',
    source: inPlay(
      'await userEvent.click(button);',
      'await expect(args.onClick).not.toHaveBeenCalled();',
    ),
    expect: [
      [
        repeat,
        '{ await userEvent.click(button); await userEvent.click(button); }',
      ],
    ],
  },
  {
    id: 'repeat-namespace-default',
    title:
      "a click on the default member of a namespace import of '@testing-library/user-event' runs twice",
    source: `import * as ue from '@testing-library/user-event';\n${inPlay('await ue.default.click(button);')}`,
    expect: [
      [
        repeat,
        '{ await ue.default.click(button); await ue.default.click(button); }',
      ],
    ],
  },
];
