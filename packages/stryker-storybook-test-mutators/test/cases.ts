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

export const cases: readonly Case[] = [
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
      'a click directly before a type on the same target makes no mutant, as type clicks first',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'a');",
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-hover-before-clear',
    title: 'a hover directly before a clear on the same target makes no mutant',
    source: inPlay(
      'await userEvent.hover(input);',
      'await userEvent.clear(input);',
    ),
    expect: [[interaction, ';']],
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
];
