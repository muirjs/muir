export interface Case {
  readonly id: string;
  readonly title: string;
  /** A story file. */
  readonly source: string;
  /** The mutants the mutators make: [mutator name, replacement]. */
  readonly expect: readonly (readonly [string, string])[];
}

const interaction = 'LzStorybookInteraction';

function inPlay(...statements: readonly string[]): string {
  return `export const Story = {\n  play: async ({ canvas, userEvent }) => {\n    ${statements.join('\n    ')}\n  },\n};\n`;
}

// The user-event 14 methods that act on the page, with arguments.
const userEventCalls: readonly (readonly [string, string])[] = [
  ['click', 'button'],
  ['dblClick', 'button'],
  ['tripleClick', 'button'],
  ['hover', 'button'],
  ['unhover', 'button'],
  ['tab', ''],
  ['keyboard', "'{Enter}'"],
  ['pointer', "{ keys: '[MouseLeft]', target: button }"],
  ['type', "button, 'a'"],
  ['clear', 'button'],
  ['selectOptions', "button, 'a'"],
  ['deselectOptions', "button, 'a'"],
  ['upload', 'button, file'],
  ['copy', ''],
  ['cut', ''],
  ['paste', "'a'"],
];

const rawDomCalls: readonly string[] = [
  'blur()',
  'click()',
  "dispatchEvent(new Event('input'))",
];

export const interactionCases: readonly Case[] = [
  ...userEventCalls.map(([method, args]) => ({
    id: `user-event-method-${method}`,
    title: `an awaited userEvent.${method} statement is removed`,
    source: inPlay(`await userEvent.${method}(${args});`),
    expect: [[interaction, ';'] as const],
  })),
  ...rawDomCalls.map((call) => ({
    id: `raw-dom-${call.slice(0, call.indexOf('('))}`,
    title: `a raw DOM element's ${call} statement is removed`,
    source: inPlay(`button.${call};`),
    expect: [[interaction, ';'] as const],
  })),
  {
    id: 'user-event-click',
    title: 'an awaited userEvent.click statement is removed',
    source: inPlay("await userEvent.click(canvas.getByRole('button'));"),
    expect: [[interaction, ';']],
  },
  {
    id: 'expect-statement',
    title: 'an expect statement makes no mutant',
    source: inPlay(
      "await expect(canvas.getByRole('button')).toBeInTheDocument();",
    ),
    expect: [],
  },
  {
    id: 'context-user-event',
    title: 'a context.userEvent.type statement is removed',
    source: `export const Story = {\n  play: async (context) => {\n    await context.userEvent.type(context.canvas.getByRole('textbox'), 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'user-event-setup',
    title: 'a call on a local bound to userEvent.setup() is removed',
    source: inPlay(
      'const user = userEvent.setup();',
      "await user.keyboard('{Enter}');",
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'user-event-setup-let',
    title: 'a call on a let bound to userEvent.setup() is removed',
    source: inPlay(
      'let user = userEvent.setup();',
      "await user.click(canvas.getByRole('button'));",
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'user-event-setup-from-helper',
    title:
      "a call on a setup instance from a helper's return value makes no mutant",
    source: inPlay(
      'const { user } = await openMenu(canvas);',
      "await user.click(canvas.getByRole('button'));",
    ),
    expect: [],
  },
  {
    id: 'user-event-setup-let-assigned',
    title: 'a call on a let assigned userEvent.setup() once is removed',
    source: inPlay(
      'let user;',
      'user = userEvent.setup();',
      "await user.keyboard('{Enter}');",
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'user-event-setup-let-reassigned',
    title: 'a call on a let reassigned after userEvent.setup() makes no mutant',
    source: inPlay(
      'let user = userEvent.setup();',
      'user = createDriver();',
      "await user.keyboard('{Enter}');",
    ),
    expect: [],
  },
  {
    id: 'user-event-not-interaction',
    title: 'a userEvent call that interacts with nothing makes no mutant',
    source: inPlay('userEvent.setup();'),
    expect: [],
  },
  {
    id: 'fire-event-member',
    title: 'an awaited fireEvent.click statement is removed',
    source: inPlay("await fireEvent.click(canvas.getByRole('button'));"),
    expect: [[interaction, ';']],
  },
  {
    id: 'fire-event-call',
    title: 'a fireEvent(element, event) statement is removed',
    source: inPlay(
      "fireEvent(canvas.getByRole('button'), new MouseEvent('click'));",
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'composed-play',
    title:
      "a composed play, another story's play called with the context, is removed",
    source: `export const Other = { play: async () => {} };\nexport const Story = {\n  play: async (context) => {\n    await Other.play(context);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'composed-run',
    title: "a CSF factory story's run() is removed",
    source: `export const Other = meta.story({});\nexport const Story = meta.story({\n  play: async () => {\n    await Other.run();\n  },\n});\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'composed-optional-play',
    title: "an optional call of the meta's play is removed",
    source: `const meta = {};\nexport default meta;\nexport const Story = {\n  play: async (context) => {\n    await meta.play?.(context);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'composed-step',
    title: "a step that runs another story's play is removed",
    source: `export const Other = { play: async () => {} };\nexport const Story = {\n  play: async ({ step }) => {\n    await step('Enter value', Other.play);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'raw-dom-focus',
    title: "a raw DOM element's focus() statement is removed",
    source: inPlay("canvas.getByRole('textbox').focus();"),
    expect: [[interaction, ';']],
  },
  {
    id: 'raw-dom-arity',
    title:
      'a click with an argument on a receiver that is no user-event makes no mutant',
    source: inPlay("await helper.click(canvas.getByRole('button'));"),
    expect: [],
  },
  {
    id: 'step-expression-body',
    title:
      'an interaction that is the expression body of a step callback becomes undefined',
    source: `export const Story = {\n  play: async ({ step, userEvent }) => {\n    await step('Submit', () => userEvent.click(button));\n  },\n};\n`,
    expect: [[interaction, 'undefined']],
  },
  {
    id: 'skip-before-each',
    title: 'an interaction in a beforeEach makes no mutant',
    source: `export const Story = {\n  beforeEach: async ({ userEvent }) => {\n    await userEvent.click(button);\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'skip-after-each-method',
    title: 'an interaction in an afterEach method makes no mutant',
    source: `export default {\n  async afterEach() {\n    button.blur();\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'skip-before-each-cleanup',
    title:
      'an interaction in the cleanup function a beforeEach returns makes no mutant',
    source: `export const Story = {\n  beforeEach: () => () => {\n    button.blur();\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'skip-negative-only',
    title:
      'an interaction whose following checks are all negative makes no mutant',
    source: inPlay(
      'await userEvent.click(button);',
      'await expect(args.onClick).not.toHaveBeenCalled();',
    ),
    expect: [],
  },
  {
    id: 'negative-only-until-next-interaction',
    title:
      'the checks that decide a skip end at the next interaction, so only the last of two clicks is skipped',
    source: inPlay(
      'await userEvent.click(first);',
      'await userEvent.click(second);',
      'await expect(args.onClick).not.toHaveBeenCalled();',
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'negative-and-positive',
    title: 'an interaction followed by a positive check is removed',
    source: inPlay(
      'await userEvent.click(button);',
      'await expect(args.onClick).not.toHaveBeenCalledTimes(2);',
      'await expect(args.onClick).toHaveBeenCalled();',
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'negative-only-after-step',
    title:
      'an interaction in a step whose following checks in the play are all negative makes no mutant',
    source: `export const Story = {\n  play: async ({ step, userEvent }) => {\n    await step('Click', async () => {\n      await userEvent.click(button);\n    });\n    await expect(args.onClick).not.toHaveBeenCalled();\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'skip-click-before-type',
    title:
      'a click directly before a type on the same target gets no mutant and the type gets one, as type clicks first',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'a');",
    ),
    expect: [[interaction, ';']],
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
    id: 'skip-type-cleared-later',
    title:
      'a type that a later clear of the same target undoes before any check makes no mutant',
    source: inPlay(
      "await userEvent.type(input, 'a');",
      'await userEvent.clear(input);',
      "await userEvent.type(input, 'b');",
      "await expect(input).toHaveValue('b');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'type-checked-before-clear',
    title: 'a type checked before a later clear of the same target is removed',
    source: inPlay(
      "await userEvent.type(input, 'a');",
      "await expect(input).toHaveValue('a');",
      'await userEvent.clear(input);',
      "await expect(input).toHaveValue('');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'composed-play-non-null',
    title:
      'a composed play called through a non-null assertion, Other.play!(context), is removed',
    source: `export const Other = { play: async () => {} };\nexport const Story = {\n  play: async (context) => {\n    await Other.play!(context);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'composed-step-non-null',
    title:
      "a step that runs another story's play through a non-null assertion is removed",
    source: `export const Other = { play: async () => {} };\nexport const Story = {\n  play: async ({ step }) => {\n    await step('Enter value', Other.play!);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'awaited-type-assertion',
    title: 'an awaited interaction inside an as expression is removed',
    source: inPlay('await (userEvent.click(button) as Promise<void>);'),
    expect: [[interaction, ';']],
  },
  {
    id: 'await-in-type-assertion',
    title: 'an await of an interaction inside an as expression is removed',
    source: inPlay('(await userEvent.click(button)) as unknown;'),
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-before-each-array',
    title: 'an interaction in a beforeEach given in an array makes no mutant',
    source: `export const Story = {\n  beforeEach: [\n    async ({ userEvent }) => {\n      await userEvent.click(button);\n    },\n  ],\n};\n`,
    expect: [],
  },
  {
    id: 'skip-after-each-array',
    title: 'an interaction in an afterEach given in an array makes no mutant',
    source: `export default {\n  afterEach: [\n    () => {\n      button.blur();\n    },\n  ],\n};\n`,
    expect: [],
  },
  {
    id: 'type-used-before-clear',
    title:
      'a type that another interaction uses before a later clear of the same target is removed',
    source: inPlay(
      "await userEvent.type(input, 'a');",
      'await userEvent.click(submit);',
      'await userEvent.clear(input);',
      "await expect(args.onSubmit).toHaveBeenCalledWith('a');",
    ),
    expect: [
      [interaction, ';'],
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
    id: 'negative-only-until-step-interaction',
    title:
      'the checks that decide a skip end at a step holding an interaction, so only the click in the step is skipped',
    source: `export const Story = {\n  play: async ({ step, userEvent }) => {\n    await userEvent.click(first);\n    await step('Second', async () => {\n      await userEvent.click(second);\n    });\n    await expect(args.onClick).not.toHaveBeenCalled();\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-negative-only-in-step',
    title:
      'an interaction followed only by a step of negative checks makes no mutant',
    source: `export const Story = {\n  play: async ({ step, userEvent }) => {\n    await userEvent.click(button);\n    await step('Check', async () => {\n      await expect(args.onClick).not.toHaveBeenCalled();\n    });\n  },\n};\n`,
    expect: [],
  },
];

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

const target = 'LzStorybookInteractionTarget';

export const targetCases: readonly Case[] = [
  {
    id: 'target-role-name',
    title:
      'the name of a role query an interaction acts on becomes the name the same role query takes elsewhere in the file',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button', { name: 'Save' }));",
      "await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));",
    ),
    expect: [
      [target, "'Cancel'"],
      [target, "'Save'"],
    ],
  },
  {
    id: 'target-check-subject',
    title:
      'a query that no interaction acts on, such as the subject of a check, gives its value but makes no mutant',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button', { name: 'Save' }));",
      "await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeVisible();",
    ),
    expect: [[target, "'Cancel'"]],
  },
  {
    id: 'target-skip-negative-only',
    title:
      'an interaction whose following checks are all negative makes no mutant',
    source: inPlay(
      "await expect(canvas.getByRole('tab', { name: 'Profile' })).toBeVisible();",
      "await userEvent.click(canvas.getByRole('tab', { name: 'Billing' }));",
      'await expect(args.onChange).not.toHaveBeenCalled();',
    ),
    expect: [],
  },
  {
    id: 'target-text',
    title:
      'the text of a text query an interaction acts on becomes the text the same query takes elsewhere in the file',
    source: inPlay(
      "await userEvent.click(canvas.getByText('Bold'));",
      "await expect(canvas.getByText('Italic')).toBeVisible();",
    ),
    expect: [[target, "'Italic'"]],
  },
  {
    id: 'target-awaited-find-by-role',
    title:
      'the name of an awaited findByRole query an interaction acts on becomes the name another findByRole query of that role takes',
    source: inPlay(
      "await userEvent.click(await canvas.findByRole('button', { name: 'Save' }));",
      "await expect(await canvas.findByRole('button', { name: 'Cancel' })).toBeVisible();",
    ),
    expect: [[target, "'Cancel'"]],
  },
  {
    id: 'target-other-role',
    title: 'a name that a query of another role takes is no replacement',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button', { name: 'Save' }));",
      "await expect(canvas.getByRole('link', { name: 'Home' })).toBeVisible();",
    ),
    expect: [],
  },
  {
    id: 'target-get-and-find-by-role',
    title:
      'the name of a getByRole query becomes the name a findByRole query of the same role takes',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button', { name: 'Save' }));",
      "await expect(await canvas.findByRole('button', { name: 'Cancel' })).toBeVisible();",
    ),
    expect: [[target, "'Cancel'"]],
  },
  {
    id: 'target-role-variable',
    title:
      'a role query whose role is no string literal makes no mutant, as its role is unknown',
    source: inPlay(
      'await userEvent.click(canvas.getByRole(role, { name: "One" }));',
      'await userEvent.click(canvas.getByRole(other, { name: "Two" }));',
    ),
    expect: [],
  },
  {
    id: 'target-quoted-name-key',
    title: "a role query's name under a quoted key is swapped too",
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button', { 'name': 'Save' }));",
      "await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));",
    ),
    expect: [
      [target, "'Cancel'"],
      [target, "'Save'"],
    ],
  },
  {
    id: 'target-step-body',
    title:
      'the target query of an interaction that is the expression body of a step is swapped too',
    source: `export const Story = {\n  play: async ({ canvas, step, userEvent }) => {\n    await step('Save', () => userEvent.click(canvas.getByRole('button', { name: 'Save' })));\n    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeVisible();\n  },\n};\n`,
    expect: [[target, "'Cancel'"]],
  },
  {
    id: 'target-fire-event',
    title: 'the target of a fireEvent call is swapped too',
    source: inPlay(
      "await fireEvent.click(canvas.getByTestId('save'));",
      "await expect(canvas.getByTestId('cancel')).toBeVisible();",
    ),
    expect: [[target, "'cancel'"]],
  },
  {
    id: 'target-skip-before-each',
    title: 'an interaction in a beforeEach makes no mutant',
    source: `export const Story = {\n  beforeEach: async ({ userEvent }) => {\n    await userEvent.click(canvas.getByTestId('save'));\n  },\n  play: async ({ canvas }) => {\n    await expect(canvas.getByTestId('cancel')).toBeVisible();\n  },\n};\n`,
    expect: [],
  },
];

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
    id: 'repeat-hover',
    title: 'a hover makes no mutant, as a second hover changes nothing',
    source: inPlay('await userEvent.hover(button);'),
    expect: [],
  },
  {
    id: 'repeat-skip-click-before-type',
    title:
      'a click directly before a type on the same target makes no mutant, as type clicks first',
    source: inPlay(
      'await userEvent.click(input);',
      "await userEvent.type(input, 'a');",
    ),
    expect: [],
  },
  {
    id: 'repeat-skip-negative-only',
    title: 'a click whose following checks are all negative makes no mutant',
    source: inPlay(
      'await userEvent.click(button);',
      'await expect(args.onClick).not.toHaveBeenCalled();',
    ),
    expect: [],
  },
];

const assertionBefore = 'LzStorybookAssertionBefore';

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
      'the copied check is the first expect statement after the interaction, past statements that check nothing',
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
    id: 'assertion-before-skip-wait-for',
    title:
      'an interaction whose first check is inside a waitFor makes no mutant, as the copy would wait and then fail',
    source: inPlay(
      'await userEvent.click(open);',
      "await waitFor(() => expect(canvas.getByRole('dialog')).toBeVisible());",
    ),
    expect: [],
  },
  {
    id: 'assertion-before-skip-negative',
    title:
      'an interaction whose first check is negative makes no mutant, as a negative check mostly holds before too',
    source: inPlay(
      'await userEvent.click(save);',
      "await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();",
      'await expect(args.onSave).toHaveBeenCalled();',
    ),
    expect: [],
  },
  {
    id: 'assertion-before-skip-called-zero-times',
    title:
      'an interaction whose first check is toHaveBeenCalledTimes(0) makes no mutant, as a fresh spy passes it',
    source: inPlay(
      'await userEvent.click(cancel);',
      'await expect(args.onSave).toHaveBeenCalledTimes(0);',
    ),
    expect: [],
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
];

const waitFor = 'LzStorybookWaitFor';

export const waitForCases: readonly Case[] = [
  {
    id: 'wait-for-arrow',
    title:
      'a waitFor of an arrow with an expression body runs the body once, in an async arrow',
    source: inPlay(
      "await waitFor(() => expect(canvas.getByText('Saved')).toBeVisible());",
    ),
    expect: [
      [
        waitFor,
        "(async () => expect(canvas.getByText('Saved')).toBeVisible())()",
      ],
    ],
  },
  {
    id: 'wait-for-find-by',
    title: 'a findBy query becomes the getBy query on the same receiver',
    source: inPlay("await canvas.findByText('Saved');"),
    expect: [[waitFor, "canvas.getByText('Saved')"]],
  },
  {
    id: 'wait-for-find-all-by',
    title: 'a findAllBy query becomes the getAllBy query on the same receiver',
    source: inPlay("await screen.findAllByRole('row');"),
    expect: [[waitFor, "screen.getAllByRole('row')"]],
  },
  {
    id: 'wait-for-element-removed',
    title: 'a waitForElementToBeRemoved statement is removed',
    source: inPlay(
      "await waitForElementToBeRemoved(() => canvas.queryByRole('progressbar'));",
    ),
    expect: [[waitFor, ';']],
  },
  {
    id: 'wait-for-vi',
    title: "Vitest's vi.waitFor makes no mutant",
    source: inPlay('await vi.waitFor(() => expect(spy).toHaveBeenCalled());'),
    expect: [],
  },
];
