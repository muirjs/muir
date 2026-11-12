import { type Case, inPlay } from './support/case.ts';

const interaction = 'LzStorybookInteraction';

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

// The methods that only Vitest browser's userEvent has, with arguments.
const vitestBrowserCalls: readonly (readonly [string, string])[] = [
  ['fill', "input, 'a'"],
  ['dragAndDrop', 'card, column'],
  ['wheel', "list, { direction: 'down' }"],
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
  ...vitestBrowserCalls.map(([method, args]) => ({
    id: `vitest-browser-method-${method}`,
    title: `an awaited Vitest browser userEvent.${method} statement is removed`,
    source: `import { userEvent } from 'vitest/browser';\n${inPlay(`await userEvent.${method}(${args});`)}`,
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
    id: 'user-event-setup-context',
    title:
      "a call on a local bound to the play context's userEvent.setup() is removed",
    source: `export const Story = {\n  play: async (context) => {\n    const user = context.userEvent.setup();\n    await user.click(button);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'vitest-browser-setup',
    title:
      "a call on a local bound to the setup() of userEvent imported under another name from 'vitest/browser' is removed",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\n${inPlay('const user = browserUserEvent.setup();', 'await user.click(button);')}`,
    expect: [[interaction, ';']],
  },
  {
    id: 'user-event-setup-let-for-of',
    title:
      'a call on a let given userEvent.setup() and then each value of a for...of makes no mutant',
    source: inPlay(
      'let user = userEvent.setup();',
      'for (user of drivers) {}',
      "await user.keyboard('{Enter}');",
    ),
    expect: [],
  },
  {
    id: 'vitest-browser-dynamic-import',
    title:
      "a call on userEvent destructured under another name from import('vitest/browser') is removed",
    source: inPlay(
      "const { userEvent: trustedUserEvent } = await import('vitest/browser');",
      "await trustedUserEvent.click(canvas.getByRole('button'));",
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'vitest-browser-context-dynamic-import',
    title:
      "a call on userEvent destructured under another name from import('@vitest/browser/context') is removed",
    source: inPlay(
      "const { userEvent: pointer } = await import('@vitest/browser/context');",
      "await pointer.hover(canvas.getByRole('button'));",
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'vitest-browser-conditional',
    title:
      "a call on a local that is import('vitest/browser')'s userEvent or userEvent is removed",
    source: inPlay(
      "const pointer = '__vitest_browser__' in globalThis ? (await import('vitest/browser')).userEvent : userEvent;",
      "await pointer.hover(canvas.getByRole('button'));",
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'vitest-browser-named-import',
    title:
      "a call on userEvent imported under another name from 'vitest/browser' is removed",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\n${inPlay("await browserUserEvent.click(canvas.getByRole('button'));")}`,
    expect: [[interaction, ';']],
  },
  {
    id: 'vitest-browser-namespace-import',
    title:
      "a call on the userEvent of a namespace import of 'vitest/browser' is removed",
    source: `import * as browser from 'vitest/browser';\n${inPlay("await browser.userEvent.click(canvas.getByRole('button'));")}`,
    expect: [[interaction, ';']],
  },
  {
    id: 'vitest-browser-other-member',
    title:
      "a call on another member of import('vitest/browser') under a user-event's name makes no mutant",
    source: inPlay(
      "const { page: trustedUserEvent } = await import('vitest/browser');",
      "await trustedUserEvent.click(canvas.getByRole('button'));",
    ),
    expect: [],
  },
  {
    id: 'other-module-user-event',
    title:
      "a call on userEvent destructured from another module's import() makes no mutant",
    source: inPlay(
      "const { userEvent: pointer } = await import('./driver');",
      "await pointer.hover(canvas.getByRole('button'));",
    ),
    expect: [],
  },
  {
    id: 'context-user-event-renamed',
    title:
      "a call on the play context's userEvent destructured under another name is removed",
    source: `export const Story = {\n  play: async ({ canvas, userEvent: user }) => {\n    await user.click(canvas.getByRole('button'));\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'test-context-user-event-renamed',
    title:
      "a call on a story test's context userEvent destructured under another name is removed",
    source: `export const Story = meta.story({});\nStory.test('clicks', async ({ canvas, userEvent: user }) => {\n  await user.click(canvas.getByRole('button'));\n});\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'context-other-key-renamed',
    title:
      "a call on another context key destructured under a user-event's name makes no mutant",
    source: `export const Story = {\n  play: async ({ canvas, driver: user }) => {\n    await user.click(canvas.getByRole('button'));\n  },\n};\n`,
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
    id: 'raw-dom-in-render',
    title: "a raw DOM element's focus() in a story's render makes no mutant",
    source: `export const Story = {\n  render: () => {\n    input.focus();\n    return null;\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'raw-dom-in-story-test',
    title: "a raw DOM element's click() in a story test's body is removed",
    source: `export const Story = meta.story({});\nStory.test('clicks', async () => {\n  button.click();\n});\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'raw-dom-in-named-play',
    title:
      "a raw DOM element's click() in a play function declared in the file and given by name is removed",
    source: `const play = async () => {\n  button.click();\n};\nexport const Story = { play };\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'raw-dom-in-assigned-play',
    title:
      "a raw DOM element's click() in a play function assigned to the story is removed",
    source: `export const Story = {};\nStory.play = async () => {\n  button.click();\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'composed-play-in-assigned-play',
    title:
      'a composed play in a play function assigned to the story is removed',
    source: `export const Other = { play: async () => {} };\nexport const Story = {};\nStory.play = async (context) => {\n  await Other.play(context);\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'raw-dom-in-unexported-story-test',
    title:
      "a raw DOM element's click() in a .test() body of a story the file does not export makes no mutant",
    source: `const Story = meta.story({});\nStory.test('clicks', async () => {\n  button.click();\n});\n`,
    expect: [],
  },
  {
    id: 'raw-dom-in-story-test-of-same-name',
    title:
      "a raw DOM element's click() in a later .test() body with the same name makes no mutant, as Storybook runs only the first",
    source: `export const Story = meta.story({});\nStory.test('clicks', async () => {});\nStory.test('clicks', async () => {\n  button.click();\n});\n`,
    expect: [],
  },
  {
    id: 'raw-dom-in-excluded-export-play',
    title:
      "a raw DOM element's click() in the play of an export that excludeStories leaves out makes no mutant",
    source: `export default { excludeStories: ['helper'] };\nexport const helper = {\n  play: async () => {\n    button.click();\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'play-call-in-render-object-play',
    title:
      "a video's play() in a play property of an object a render builds makes no mutant",
    source: `export const Story = {\n  render: () => {\n    const player = {\n      play: () => {\n        video.play();\n      },\n    };\n    return player;\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'raw-dom-in-decorator',
    title:
      "a raw DOM element's dispatchEvent(event) in a decorator makes no mutant",
    source: `export default {\n  decorators: [\n    (Story) => {\n      window.dispatchEvent(new Event('resize'));\n      return Story();\n    },\n  ],\n};\n`,
    expect: [],
  },
  {
    id: 'play-call-in-render',
    title: "a video's play() in a story's render makes no mutant",
    source: `export const Story = {\n  render: () => {\n    useEffect(() => {\n      video.play();\n    });\n    return null;\n  },\n};\n`,
    expect: [],
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
    id: 'context-step-expression-body',
    title:
      'an interaction that is the expression body of a context.step callback becomes undefined',
    source: `export const Story = {\n  play: async (context) => {\n    await context.step('Submit', () => context.userEvent.click(button));\n  },\n};\n`,
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
    id: 'vitest-browser-click-before-type',
    title:
      'a Vitest browser click directly before a type on the same target is removed, as that type does not click',
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\n${inPlay('await browserUserEvent.click(input);', "await browserUserEvent.type(input, 'a');")}`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'vitest-browser-namespace-click-before-type',
    title:
      "a click directly before a type on the same target, both on the userEvent of a namespace import of 'vitest/browser', is removed",
    source: `import * as browser from 'vitest/browser';\n${inPlay('await browser.userEvent.click(input);', "await browser.userEvent.type(input, 'a');")}`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'vitest-browser-choice-click-before-type',
    title:
      "a click directly before a type on the same target, both on a local that is import('vitest/browser')'s userEvent or userEvent, is removed",
    source: inPlay(
      "const pointer = '__vitest_browser__' in globalThis ? (await import('vitest/browser')).userEvent : userEvent;",
      'await pointer.click(input);',
      "await pointer.type(input, 'a');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'vitest-browser-setup-click-before-type',
    title:
      'a click directly before a type on the same target, both on the setup() of a Vitest browser userEvent, is removed',
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\n${inPlay('const user = browserUserEvent.setup();', 'await user.click(input);', "await user.type(input, 'a');")}`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'vitest-browser-import-click-before-type',
    title:
      "a click directly before a type on the same target, both on userEvent imported from 'vitest/browser', is removed",
    source: `import { userEvent } from 'vitest/browser';\nexport const Story = {\n  play: async () => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'skip-optional-click-before-type',
    title:
      'a userEvent?.click directly before a userEvent?.type on the same target gets no mutant, as type clicks first',
    source: inPlay(
      'await userEvent?.click(input);',
      "await userEvent?.type(input, 'a');",
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
    id: 'user-event-in-type-assertion',
    title: 'a click on userEvent inside an as expression is removed',
    source: inPlay('await (userEvent as any).click(button);'),
    expect: [[interaction, ';']],
  },
  {
    id: 'fire-event-in-type-assertion',
    title: 'a fireEvent.click on fireEvent inside an as expression is removed',
    source: inPlay('await (fireEvent as any).click(button);'),
    expect: [[interaction, ';']],
  },
  {
    id: 'await-in-type-assertion',
    title: 'an await of an interaction inside an as expression is removed',
    source: inPlay('(await userEvent.click(button)) as unknown;'),
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-named-before-each',
    title:
      'an interaction in a function declared in the file and given as a beforeEach makes no mutant',
    source: `async function setup({ userEvent }) {\n  await userEvent.click(button);\n}\nexport default {\n  beforeEach: setup,\n};\n`,
    expect: [],
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
    id: 'type-used-in-step-before-clear',
    title:
      'a type that an interaction in a step uses before a later clear of the same target is removed',
    source: `export const Story = {\n  play: async ({ args, step, userEvent }) => {\n    await userEvent.type(input, 'a');\n    await step('Submit', async () => {\n      await userEvent.click(submit);\n    });\n    await userEvent.clear(input);\n    await expect(args.onSubmit).toHaveBeenCalledWith('a');\n  },\n};\n`,
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
    id: 'skip-click-before-type-skip-click-false',
    title:
      'a click directly before a type of the same target with skipClick: false makes no mutant, as that type clicks first',
    source: inPlay(
      'await userEvent.click(input);',
      "await userEvent.type(input, 'a', { skipClick: false });",
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'negative-only-until-step-interaction',
    title:
      'the checks that decide a skip end at a step holding an interaction, so only the click in the step is skipped',
    source: `export const Story = {\n  play: async ({ step, userEvent }) => {\n    await userEvent.click(first);\n    await step('Second', async () => {\n      await userEvent.click(second);\n    });\n    await expect(args.onClick).not.toHaveBeenCalled();\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'negative-only-until-context-step-interaction',
    title:
      'the checks that decide a skip end at a context.step holding an interaction, so only the click in the step is skipped',
    source: `export const Story = {\n  play: async (context) => {\n    await context.userEvent.click(first);\n    await context.step('Second', async () => {\n      await context.userEvent.click(second);\n    });\n    await expect(context.args.onClick).not.toHaveBeenCalled();\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'negative-only-after-context-step',
    title:
      'an interaction in a context.step whose following checks in the play are all negative makes no mutant',
    source: `export const Story = {\n  play: async (context) => {\n    await context.step('Click', async () => {\n      await context.userEvent.click(button);\n    });\n    await expect(context.args.onClick).not.toHaveBeenCalled();\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'skip-negative-only-in-step',
    title:
      'an interaction followed only by a step of negative checks makes no mutant',
    source: `export const Story = {\n  play: async ({ step, userEvent }) => {\n    await userEvent.click(button);\n    await step('Check', async () => {\n      await expect(args.onClick).not.toHaveBeenCalled();\n    });\n  },\n};\n`,
    expect: [],
  },
];

// Cases that once crashed the instrumenter, which fails every case it instruments together.
export const crashCases: readonly Case[] = [
  {
    id: 'user-event-choice-of-itself',
    title:
      'a call on a var given a choice between itself and userEvent makes no mutant',
    source: inPlay(
      'var user = flag ? user : userEvent;',
      'await user.click(button);',
    ),
    expect: [],
  },
  {
    id: 'user-event-choice-of-itself-assigned',
    title:
      'a call on a let assigned a choice between itself and userEvent makes no mutant',
    source: inPlay(
      'let user;',
      'user = flag ? user : userEvent;',
      'await user.click(button);',
    ),
    expect: [],
  },
  {
    id: 'user-event-setup-of-itself',
    title: 'a call on a var given its own setup() makes no mutant',
    source: inPlay('var user = user.setup();', 'await user.click(button);'),
    expect: [],
  },
];
