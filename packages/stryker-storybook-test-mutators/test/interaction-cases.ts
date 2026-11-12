import { composedPlayCases } from './composed-play-cases.ts';
import { rawDomCases } from './raw-dom-cases.ts';
import { skippedInteractionCases } from './skipped-interaction-cases.ts';
import { type Case, inPlay, inPlayWith } from './support/case.ts';

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

const interactionCases: readonly Case[] = [
  ...userEventCalls.map(([method, args]) => ({
    id: `user-event-method-${method}`,
    title: `an awaited userEvent.${method} statement is removed`,
    source: inPlay(`await userEvent.${method}(${args});`),
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
    id: 'play-method',
    title: 'an interaction in a play method is removed',
    source: `export const Story = {\n  async play({ userEvent }) {\n    await userEvent.click(button);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'top-level-interaction',
    title: 'a user-event call outside any function is removed',
    source: 'await userEvent.click(button);\nexport const Story = {};\n',
    expect: [[interaction, ';']],
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
    id: 'interaction-in-call-given-to-step',
    title:
      'an interaction inside a call given to step, which is no step callback body, makes no mutant',
    source: inPlayWith(
      ['step', 'userEvent'],
      "await step('Submit', wrap(userEvent.click(button)));",
    ),
    expect: [],
  },
  {
    id: 'arrow-body-in-declaration',
    title:
      'an interaction that is the expression body of an arrow held in a local makes no mutant',
    source: inPlay(
      'const clickSave = () => userEvent.click(save);',
      'await clickSave();',
    ),
    expect: [],
  },
  {
    id: 'arrow-body-given-to-method',
    title:
      'an interaction that is the expression body of an arrow given to a method other than step makes no mutant',
    source: inPlay('buttons.forEach((button) => userEvent.click(button));'),
    expect: [],
  },
  {
    id: 'arrow-body-given-to-nested-step',
    title:
      'an interaction that is the expression body of an arrow given to step on a member of a member makes no mutant',
    source: inPlay(
      "await story.context.step('Submit', () => userEvent.click(button));",
    ),
    expect: [],
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
    id: 'user-event-in-type-assertion',
    title: 'a click on userEvent inside an as expression is removed',
    source: inPlay('await (userEvent as any).click(button);'),
    expect: [[interaction, ';']],
  },
  {
    id: 'user-event-in-satisfies',
    title: 'a click on userEvent inside a satisfies expression is removed',
    source: inPlay('await (userEvent satisfies object).click(button);'),
    expect: [[interaction, ';']],
  },
  {
    id: 'user-event-in-angle-bracket-assertion',
    title:
      'a click on userEvent inside an angle-bracket type assertion is removed',
    source: inPlay('await (<any>userEvent).click(button);'),
    expect: [[interaction, ';']],
  },
  {
    id: 'fire-event-in-type-assertion',
    title: 'a fireEvent.click on fireEvent inside an as expression is removed',
    source: inPlay('await (fireEvent as any).click(button);'),
    expect: [[interaction, ';']],
  },
];

export const allInteractionCases: readonly Case[] = [
  ...interactionCases,
  ...composedPlayCases,
  ...rawDomCases,
  ...skippedInteractionCases,
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
