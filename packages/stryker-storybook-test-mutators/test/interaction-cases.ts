import { composedPlayCases } from './composed-play-cases.ts';
import { rawDomCases } from './raw-dom-cases.ts';
import { skippedInteractionCases } from './skipped-interaction-cases.ts';
import {
  type Case,
  inPlay,
  inPlayWith,
  namespaceSteps,
} from './support/case.ts';

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

const userEventModuleNames: readonly string[] = [
  'storybook/test',
  '@testing-library/user-event',
  'vitest/browser',
  '@vitest/browser/context',
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
    title: 'a check statement makes no mutant',
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
    id: 'optional-user-event',
    title: 'a userEvent?.click statement is removed',
    source: inPlay('await userEvent?.click(input);'),
    expect: [[interaction, ';']],
  },
  {
    id: 'context-optional-user-event',
    title: 'a context?.userEvent.click statement is removed',
    source: `export const Story = {\n  play: async (context) => {\n    await context?.userEvent.click(button);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'defaulted-context-user-event',
    title:
      "a call on the context's userEvent destructured under another name with a default is removed",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async ({ userEvent: user = browserUserEvent }) => {\n    await user.click(button);\n  },\n};\n`,
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
    id: 'user-event-setup-static-block-shadow',
    title:
      'a call on a local bound to userEvent.setup() that a class static block shadows is removed',
    source: inPlay(
      'const user = userEvent.setup();',
      'class Steps {',
      '  static {',
      '    const user = 1;',
      '  }',
      '}',
      'await user.click(button);',
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'user-event-in-namespace',
    title:
      'a click on a renamed storybook/test userEvent and a call on its setup() local in a TypeScript namespace are removed',
    source: namespaceSteps,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
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
    id: 'user-event-other-method-result',
    title:
      'a call on a local bound to the result of a userEvent method other than setup() makes no mutant',
    source: inPlay(
      'const user = userEvent.create();',
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
    id: 'user-event-setup-let-assigned-in-play',
    title:
      "a call on a let declared outside the play and assigned there the setup() of the context's userEvent destructured under another name is removed",
    source: `let user;\nexport const Story = {\n  play: async ({ userEvent: pointer }) => {\n    user = pointer.setup();\n    await user.click(button);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'user-event-alias',
    title: 'a call on a local bound to userEvent itself is removed',
    source: inPlay('const u = userEvent;', 'await u.click(button);'),
    expect: [[interaction, ';']],
  },
  {
    id: 'user-event-alias-reassigned',
    title:
      'a call on a let bound to userEvent and then given another value makes no mutant',
    source: inPlay(
      'let u = userEvent;',
      'u = createDriver();',
      'await u.click(button);',
    ),
    expect: [],
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
    id: 'storybook-test-named-import',
    title:
      "a call on userEvent imported under another name from 'storybook/test' is removed",
    source: `import { userEvent as ue } from 'storybook/test';\n${inPlay("await ue.click(canvas.getByRole('button'));")}`,
    expect: [[interaction, ';']],
  },
  {
    id: 'testing-library-default-import',
    title:
      "a call on the default import of '@testing-library/user-event' under another name is removed",
    source: `import ue from '@testing-library/user-event';\n${inPlay("await ue.click(canvas.getByRole('button'));")}`,
    expect: [[interaction, ';']],
  },
  {
    id: 'testing-library-default-named-import',
    title:
      "a call on the default export of '@testing-library/user-event' imported by name under another name is removed",
    source: `import { default as ev } from '@testing-library/user-event';\n${inPlayWith(['canvas'], "await ev.click(canvas.getByRole('button'));")}`,
    expect: [[interaction, ';']],
  },
  {
    id: 'testing-library-default-string-named-import',
    title:
      "a call on the default export of '@testing-library/user-event' imported by the string name 'default' is removed",
    source: `import { 'default' as ev } from '@testing-library/user-event';\n${inPlayWith(['canvas'], "await ev.click(canvas.getByRole('button'));")}`,
    expect: [[interaction, ';']],
  },
  {
    id: 'storybook-test-default-import-other-name',
    title:
      "a call on the default import of 'storybook/test' under another name makes no mutant, as only '@testing-library/user-event' has a user-event default export",
    source: `import ue from 'storybook/test';\n${inPlayWith(['canvas'], "await ue.click(canvas.getByRole('button'));")}`,
    expect: [],
  },
  {
    id: 'testing-library-namespace-import',
    title:
      "a call on a namespace import of '@testing-library/user-event' makes no mutant, as the namespace is no user-event",
    source: `import * as ue from '@testing-library/user-event';\n${inPlayWith(['canvas'], "await ue.click(canvas.getByRole('button'));")}`,
    expect: [],
  },
  {
    id: 'testing-library-namespace-default',
    title:
      "a call on the default member of a namespace import of '@testing-library/user-event' is removed",
    source: `import * as ue from '@testing-library/user-event';\n${inPlayWith(['canvas'], "await ue.default.click(canvas.getByRole('button'));")}`,
    expect: [[interaction, ';']],
  },
  {
    id: 'testing-library-namespace-default-in-type-assertion',
    title:
      "a call on the default member of a namespace import of '@testing-library/user-event' inside an as expression is removed",
    source: `import * as ue from '@testing-library/user-event';\n${inPlayWith(['canvas'], "await (ue as any).default.click(canvas.getByRole('button'));")}`,
    expect: [[interaction, ';']],
  },
  {
    id: 'testing-library-namespace-default-setup',
    title:
      "a call on a local bound to the setup() of the default member of a namespace import of '@testing-library/user-event' is removed",
    source: `import * as ue from '@testing-library/user-event';\n${inPlayWith(['canvas'], 'const user = ue.default.setup();', "await user.click(canvas.getByRole('button'));")}`,
    expect: [[interaction, ';']],
  },
  {
    id: 'testing-library-namespace-shadowed',
    title:
      "a call on the default member of a play parameter that shadows a namespace import of '@testing-library/user-event' makes no mutant",
    source: `import * as ue from '@testing-library/user-event';\n${inPlayWith(['canvas', 'ue'], "await ue.default.click(canvas.getByRole('button'));")}`,
    expect: [],
  },
  {
    id: 'testing-library-namespace-other-member',
    title:
      "a call on a member other than default of a namespace import of '@testing-library/user-event' makes no mutant",
    source: `import * as ue from '@testing-library/user-event';\n${inPlayWith(['canvas'], "await ue.other.click(canvas.getByRole('button'));")}`,
    expect: [],
  },
  {
    id: 'storybook-test-namespace-default',
    title:
      "a call on the default member of a namespace import of 'storybook/test' makes no mutant, as only '@testing-library/user-event' has a user-event default export",
    source: `import * as ue from 'storybook/test';\n${inPlayWith(['canvas'], "await ue.default.click(canvas.getByRole('button'));")}`,
    expect: [],
  },
  ...userEventModuleNames.map((module) => ({
    id: `named-import-${module}`,
    title: `a call on userEvent imported by name from '${module}' is removed`,
    source: `import { userEvent } from '${module}';\n${inPlayWith(['canvas'], "await userEvent.click(canvas.getByRole('button'));")}`,
    expect: [[interaction, ';'] as const],
  })),
  ...userEventModuleNames.map((module) => ({
    id: `default-import-${module}`,
    title: `a call on the default import of '${module}' named userEvent is removed`,
    source: `import userEvent from '${module}';\n${inPlayWith(['canvas'], "await userEvent.click(canvas.getByRole('button'));")}`,
    expect: [[interaction, ';'] as const],
  })),
  {
    id: 'choice-with-other-side',
    title:
      'a call on a local that is userEvent or something else makes no mutant',
    source: inPlay(
      'const pointer = flag ? userEvent : driver;',
      "await pointer.click(canvas.getByRole('button'));",
    ),
    expect: [],
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
    id: 'vitest-browser-other-import',
    title:
      "a call on another export of 'vitest/browser' imported under a user-event's name makes no mutant",
    source: `import { page as user } from 'vitest/browser';\n${inPlay("await user.click(canvas.getByRole('button'));")}`,
    expect: [],
  },
  {
    id: 'other-module-user-event',
    title:
      "a call on userEvent destructured from another module's import() is removed",
    source: inPlay(
      "const { userEvent: pointer } = await import('./driver');",
      "await pointer.hover(canvas.getByRole('button'));",
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'user-event-and-fire-event-in-render',
    title:
      "a userEvent call and a fireEvent call in a story's render are removed, where a raw DOM click is not",
    source: `import { userEvent, fireEvent } from 'storybook/test';\nexport const Story = {\n  render: () => {\n    userEvent.click(document.body);\n    fireEvent.click(document.body);\n    document.body.click();\n    return null;\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'user-event-destructured-renamed-from-local',
    title:
      "a call on userEvent destructured under another name from a local holding a function's result is removed",
    source: inPlayWith(
      ['canvas'],
      'const foo = makeDriver();',
      'const { userEvent: u } = foo;',
      "await u.click(canvas.getByRole('button'));",
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'other-module-named-import',
    title:
      'a call on userEvent imported under another name from a module that is no user-event module makes no mutant',
    source: `import { userEvent as u } from './test-utils';\n${inPlayWith(['canvas'], "await u.click(canvas.getByRole('button'));")}`,
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
    id: 'context-user-event-destructured-in-play',
    title:
      "a call on the play context's userEvent destructured under another name in the play is removed",
    source: `export const Story = {\n  play: async (context) => {\n    const { userEvent: user } = context;\n    await user.click(button);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'context-user-event-destructured-after-assignment',
    title:
      'a call on userEvent destructured from the play context after the play assigns the context is removed, as any userEvent may be one',
    source: `export const Story = {\n  play: async (context) => {\n    context = driverContext;\n    const { userEvent: user } = context;\n    await user.click(button);\n  },\n};\n`,
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
    id: 'other-member-user-event-method',
    title:
      'a call of a user-event method name on a member other than userEvent, such as window.localStorage.clear(), makes no mutant',
    source: inPlay('window.localStorage.clear();'),
    expect: [],
  },
  {
    id: 'context-other-key-beside-user-event',
    title:
      "a call on another context key destructured beside the context's userEvent makes no mutant",
    source: inPlayWith(
      ['canvas', 'userEvent', 'driver'],
      "await driver.click(canvas.getByRole('button'));",
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
      'an interaction that is the expression body of an arrow held in a local becomes undefined',
    source: inPlay(
      'const clickSave = () => userEvent.click(save);',
      'await clickSave();',
    ),
    expect: [[interaction, 'undefined']],
  },
  {
    id: 'arrow-body-given-to-method',
    title:
      'an interaction that is the expression body of an arrow given to forEach becomes undefined',
    source: inPlay('buttons.forEach((button) => userEvent.click(button));'),
    expect: [[interaction, 'undefined']],
  },
  {
    id: 'arrow-body-given-to-nested-step',
    title:
      'an interaction that is the expression body of an arrow given to step on a member of a member becomes undefined',
    source: inPlay(
      "await story.context.step('Submit', () => userEvent.click(button));",
    ),
    expect: [[interaction, 'undefined']],
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
  {
    id: 'user-event-string-key',
    title:
      "a user-event method called by a string key, userEvent['click'](x), is removed",
    source: inPlay("await userEvent['click'](button);"),
    expect: [[interaction, ';']],
  },
  {
    id: 'user-event-unknown-key',
    title:
      'a userEvent member called by a key that is no string literal, userEvent[method](x), is removed',
    source: inPlay('await userEvent[method](button);'),
    expect: [[interaction, ';']],
  },
];

const redundantInteractionCases: readonly Case[] = [
  {
    id: 'negative-only',
    title:
      'an interaction whose following checks are all negative checks is removed',
    source: inPlay(
      'await userEvent.click(button);',
      'await expect(args.onClick).not.toHaveBeenCalled();',
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'click-before-type',
    title:
      'a click directly before a type of the same target is removed, as is the type',
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
    id: 'type-cleared-later',
    title:
      'a type that a later clear of the same target undoes is removed, as are the clear and the type after it',
    source: inPlay(
      "await userEvent.type(input, 'a');",
      'await userEvent.clear(input);',
      "await userEvent.type(input, 'b');",
      "await expect(input).toHaveValue('b');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
];

export const allInteractionCases: readonly Case[] = [
  ...interactionCases,
  ...composedPlayCases,
  ...rawDomCases,
  ...skippedInteractionCases,
  ...redundantInteractionCases,
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
