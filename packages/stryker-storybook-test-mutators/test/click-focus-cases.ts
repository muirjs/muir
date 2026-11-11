import { type Case, inPlay } from './support/case.ts';

const clickFocus = 'LzStorybookClickFocus';

export const clickFocusCases: readonly Case[] = [
  {
    id: 'click-focus-click',
    title:
      'an awaited userEvent.click of an element becomes a focus() call on it',
    source: inPlay('await userEvent.click(button);'),
    expect: [[clickFocus, 'await button.focus();']],
  },
  {
    id: 'click-focus-query',
    title: 'a click of a queried element focuses the element the query returns',
    source: inPlay("await userEvent.click(canvas.getByRole('button'));"),
    expect: [[clickFocus, "await canvas.getByRole('button').focus();"]],
  },
  {
    id: 'click-focus-other-call',
    title:
      'a click of an element that a call other than a query returns makes no mutant, as that call may have effects',
    source: inPlay('await userEvent.click(openMenu());'),
    expect: [],
  },
  {
    id: 'click-focus-awaited-query',
    title: 'a click of an awaited findBy query focuses the element it finds',
    source: inPlay("await userEvent.click(await canvas.findByRole('button'));"),
    expect: [
      [clickFocus, "await (await canvas.findByRole('button')).focus();"],
    ],
  },
  {
    id: 'click-focus-non-null',
    title: 'a click of a query under a non-null assertion focuses its element',
    source: inPlay("await userEvent.click(canvas.getByRole('button')!);"),
    expect: [[clickFocus, "await canvas.getByRole('button')!.focus();"]],
  },
  {
    id: 'click-focus-step-body',
    title:
      'a click that is the expression body of a step callback becomes a focus() call',
    source: `export const Story = {\n  play: async ({ step, userEvent }) => {\n    await step('Save', () => userEvent.click(button));\n  },\n};\n`,
    expect: [[clickFocus, 'button.focus()']],
  },
  {
    id: 'click-focus-optional-call',
    title: 'a userEvent?.click of an element becomes a focus() call on it',
    source: inPlay('await userEvent?.click(button);'),
    expect: [[clickFocus, 'await button.focus();']],
  },
  {
    id: 'click-focus-type-assertion',
    title:
      'a click on userEvent inside an as expression becomes a focus() call',
    source: inPlay('await (userEvent as any).click(button);'),
    expect: [[clickFocus, 'await button.focus();']],
  },
  {
    id: 'click-focus-dbl-click',
    title: 'a userEvent.dblClick becomes a focus() call on its element',
    source: inPlay('await userEvent.dblClick(button);'),
    expect: [[clickFocus, 'await button.focus();']],
  },
  {
    id: 'click-focus-not-awaited',
    title:
      'a click that is not awaited becomes a focus() call that is not awaited',
    source: inPlay('userEvent.click(button);'),
    expect: [[clickFocus, 'button.focus();']],
  },
  {
    id: 'click-focus-skip-textbox',
    title:
      'a click of a textbox makes no mutant, as clicking a text field is meant to focus it',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox', { name: 'Name' }));",
    ),
    expect: [],
  },
  {
    id: 'click-focus-skip-found-combobox',
    title: 'a click of a combobox that a findBy query finds makes no mutant',
    source: inPlay(
      "await userEvent.click(await canvas.findByRole('combobox'));",
    ),
    expect: [],
  },
  {
    id: 'click-focus-skip-label-text',
    title:
      'a click of an element found by its label makes no mutant, as such an element is a form field',
    source: inPlay("await userEvent.click(canvas.getByLabelText('Email'));"),
    expect: [],
  },
  {
    id: 'click-focus-skip-placeholder-text',
    title: 'a click of an element found by its placeholder makes no mutant',
    source: inPlay(
      "await userEvent.click(canvas.getByPlaceholderText('Search'));",
    ),
    expect: [],
  },
  {
    id: 'click-focus-skip-found-label-text',
    title:
      'a click of an element that an awaited findByLabelText query finds makes no mutant',
    source: inPlay(
      "await userEvent.click(await canvas.findByLabelText('Email'));",
    ),
    expect: [],
  },
  {
    id: 'click-focus-skip-bound-label-text',
    title:
      'a click of a const that a getByLabelText query in the play bound makes no mutant',
    source: inPlay(
      "const email = canvas.getByLabelText('Email');",
      'await userEvent.click(email);',
    ),
    expect: [],
  },
  {
    id: 'click-focus-skip-bound-found-textbox',
    title:
      'a click of a const that an awaited findByRole query of a textbox bound makes no mutant',
    source: inPlay(
      "const name = await canvas.findByRole('textbox');",
      'await userEvent.click(name);',
    ),
    expect: [],
  },
  {
    id: 'click-focus-let-bound-label-text',
    title:
      'a click of a let that a getByLabelText query bound still focuses it, as the let may be reassigned',
    source: inPlay(
      "let email = canvas.getByLabelText('Email');",
      'await userEvent.click(email);',
    ),
    expect: [[clickFocus, 'await email.focus();']],
  },
  {
    id: 'click-focus-skip-negative-only',
    title:
      'a click whose following checks are all negative makes no mutant, as focusing also leaves them true',
    source: inPlay(
      'await userEvent.click(button);',
      'await expect(args.onClick).not.toHaveBeenCalled();',
    ),
    expect: [],
  },
  {
    id: 'click-focus-skip-click-before-type',
    title:
      'a click directly before a type on the same target makes no mutant, as type clicks first',
    source: inPlay(
      'await userEvent.click(input);',
      "await userEvent.type(input, 'a');",
    ),
    expect: [],
  },
  {
    id: 'click-focus-skip-before-each',
    title: 'a click in a beforeEach makes no mutant',
    source: `export const Story = {\n  beforeEach: async ({ userEvent }) => {\n    await userEvent.click(button);\n  },\n};\n`,
    expect: [],
  },
];
