import { type Case, inPlay, inPlayWith } from './support/case.ts';

const interaction = 'LzStorybookInteraction';

export const clickBeforeTypeCases: readonly Case[] = [
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
    id: 'skip-hover-before-type',
    title:
      'a hover directly before a type on the same target gets no mutant and the type gets one, as type clicks first',
    source: inPlay(
      'await userEvent.hover(input);',
      "await userEvent.type(input, 'a');",
    ),
    expect: [[interaction, ';']],
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
    id: 'skip-click-before-type-other-options',
    title:
      'a click directly before a type of the same target with options but no skipClick makes no mutant',
    source: inPlay(
      'await userEvent.click(input);',
      "await userEvent.type(input, 'a', { delay: 10 });",
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-default-import-click-before-type',
    title:
      "a click directly before a type on the same target, both on userEvent default-imported from '@testing-library/user-event', makes no mutant",
    source: `import userEvent from '@testing-library/user-event';\n${inPlayWith(['canvas'], "await userEvent.click(canvas.getByRole('textbox'));", "await userEvent.type(canvas.getByRole('textbox'), 'a');")}`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-storybook-import-click-before-type',
    title:
      "a click directly before a type on the same target, both on userEvent imported from 'storybook/test', makes no mutant",
    source: `import { userEvent } from 'storybook/test';\n${inPlayWith(['canvas'], "await userEvent.click(canvas.getByRole('textbox'));", "await userEvent.type(canvas.getByRole('textbox'), 'a');")}`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-renamed-import-click-before-type',
    title:
      "a click directly before a type on the same target, both on userEvent imported under another name from 'storybook/test', makes no mutant",
    source: `import { userEvent as ue } from 'storybook/test';\nexport const Story = {\n  play: async () => {\n    await ue.click(input);\n    await ue.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-context-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of a play context that is not destructured, makes no mutant',
    source: `export const Story = {\n  play: async (context) => {\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-optional-context-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of a play context read through ?., makes no mutant',
    source: `export const Story = {\n  play: async (context) => {\n    await context?.userEvent.click(input);\n    await context?.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-testing-library-import-click-before-type',
    title:
      "a click directly before a type on the same target, both on userEvent imported from '@testing-library/user-event', makes no mutant",
    source: `import { userEvent } from '@testing-library/user-event';\nexport const Story = {\n  play: async () => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-renamed-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent destructured under another name, makes no mutant",
    source: inPlayWith(
      ['userEvent: user'],
      'await user.click(input);',
      "await user.type(input, 'a');",
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-setup-click-before-type',
    title:
      "a click directly before a type on the same target, both on the setup() of userEvent imported from 'storybook/test', makes no mutant",
    source: `import { userEvent } from 'storybook/test';\nexport const Story = {\n  play: async () => {\n    const user = userEvent.setup();\n    await user.click(input);\n    await user.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-context-play-method-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of the context of a play method, makes no mutant',
    source: `export const Story = {\n  async play(context) {\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-meta-play-click-before-type',
    title:
      "a click directly before a type on the same target, both on the userEvent of the context of the meta's play, makes no mutant",
    source: `export default {\n  play: async (context) => {\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\nexport const Story = {};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-factory-play-click-before-type',
    title:
      "a click directly before a type on the same target, both on the userEvent destructured in the context of a CSF factory story's play, makes no mutant",
    source: `import preview from '../.storybook/preview';\nconst meta = preview.meta({});\nexport const Story = meta.story({\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n});\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-choice-click-before-type',
    title:
      'a click directly before a type on the same target, both on a local that is one of two user-event 14 instances, makes no mutant',
    source: inPlay(
      'const slowUser = userEvent.setup({ delay: 100 });',
      'const user = slow ? slowUser : userEvent;',
      'await user.click(input);',
      "await user.type(input, 'a');",
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
    id: 'vitest-browser-dynamic-import-click-before-type',
    title:
      "a click directly before a type on the same target, both on userEvent destructured under another name from import('vitest/browser'), is removed",
    source: inPlay(
      "const { userEvent: trustedUserEvent } = await import('vitest/browser');",
      'await trustedUserEvent.click(input);',
      "await trustedUserEvent.type(input, 'a');",
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
    id: 'local-module-setup-click-before-type',
    title:
      'a click directly before a type on the same target, both on the setup() of userEvent imported from a module of the project, is removed',
    source: `import { userEvent } from './test-utils';\nexport const Story = {\n  play: async () => {\n    const user = userEvent.setup();\n    await user.click(input);\n    await user.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'story-test-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on a story test's context userEvent, is removed, as only a play's context is read as user-event 14",
    source: `export const Story = meta.story({});\nStory.test('types', async ({ userEvent }) => {\n  await userEvent.click(input);\n  await userEvent.type(input, 'a');\n});\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'local-module-import-click-before-type',
    title:
      "a click directly before a type on the same target, both on userEvent imported from a module of the project, is removed, as that module may export Vitest browser's",
    source: `import { userEvent } from './test-utils';\nexport const Story = {\n  play: async () => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'local-module-default-import-click-before-type',
    title:
      'a click directly before a type on the same target, both on userEvent default-imported from a module of the project, is removed',
    source: `import userEvent from './test-utils';\nexport const Story = {\n  play: async () => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'unbound-click-before-type',
    title:
      'a click directly before a type on the same target, both on a userEvent the file does not bind, is removed',
    source: `export const Story = {\n  play: async () => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'object-member-click-before-type',
    title:
      "a click directly before a type on the same target, both on the userEvent of an object that is no play context, is removed, as that userEvent may be Vitest browser's",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nconst page = { userEvent: browserUserEvent };\n${inPlay('await page.userEvent.click(input);', "await page.userEvent.type(input, 'a');")}`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'vitest-browser-page-member-click-before-type',
    title:
      "a click directly before a type on the same target, both on the userEvent of page imported from 'vitest/browser', is removed",
    source: `import { page } from 'vitest/browser';\n${inPlay('await page.userEvent.click(input);', "await page.userEvent.type(input, 'a');")}`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'call-result-member-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of an awaited call result, is removed',
    source: inPlay(
      '(await openForm()).userEvent.click(input);',
      "(await openForm()).userEvent.type(input, 'a');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'function-parameter-member-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of a parameter of a function that is no play, is removed',
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\n${inPlay(
      'const fill = async (page) => {',
      '  await page.userEvent.click(input);',
      "  await page.userEvent.type(input, 'a');",
      '};',
      'await fill({ userEvent: browserUserEvent });',
    )}`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'other-object-play-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of the parameter of a play property of an object that is no story, is removed',
    source: `const helpers = {\n  play: async (page) => {\n    await page.userEvent.click(input);\n    await page.userEvent.type(input, 'a');\n  },\n};\nexport const Story = {};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'function-parameter-destructured-click-before-type',
    title:
      'a click directly before a type on the same target, both on userEvent destructured in the parameter of a function that is no play, is removed',
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\n${inPlay(
      'const fill = async ({ userEvent: user }) => {',
      '  await user.click(input);',
      "  await user.type(input, 'a');",
      '};',
      'await fill({ userEvent: browserUserEvent });',
    )}`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'play-context-named-user-event-click-before-type',
    title:
      'a click directly before a type on the same target, both on a play context named userEvent, is removed, as the context is no user-event',
    source: `export const Story = {\n  play: async (userEvent) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'play-context-key-member-click-before-type',
    title:
      "a click directly before a type on the same target, both on the userEvent of a key destructured from a play's context, is removed, as that key may hold anything",
    source: inPlayWith(
      ['page'],
      'await page.userEvent.click(input);',
      "await page.userEvent.type(input, 'a');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'second-play-parameter-click-before-type',
    title:
      "a click directly before a type on the same target, both on the userEvent of a play's second parameter, is removed, as Storybook gives the context as the first",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async (context, page = { userEvent: browserUserEvent }) => {\n    await page.userEvent.click(input);\n    await page.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'nested-play-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of the parameter of a play property inside a play, is removed, as the play calls it with a context of its own',
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\n${inPlay(
      'const inner = {',
      '  play: async (page) => {',
      '    await page.userEvent.click(input);',
      "    await page.userEvent.type(input, 'a');",
      '  },',
      '};',
      'await inner.play({ userEvent: browserUserEvent });',
    )}`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'shadowed-setup-click-before-type',
    title:
      "a click directly before a type on the same target, both on a local given the setup() of Vitest browser's userEvent, is removed, though a play parameter of the same name hides that userEvent where the click is",
    source: `import { userEvent } from 'vitest/browser';\nconst user = userEvent.setup();\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await user.click(input);\n    await user.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'shadowed-member-setup-click-before-type',
    title:
      "a click directly before a type on the same target, both on a local given the setup() of another object's userEvent, is removed, though a play context of the same name hides that object where the click is",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nconst context = { userEvent: browserUserEvent };\nconst user = context.userEvent.setup();\nexport const Story = {\n  play: async (context) => {\n    await user.click(input);\n    await user.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'shadowed-choice-click-before-type',
    title:
      "a click directly before a type on the same target, both on a local that is another object's userEvent on either side of a choice, is removed, though a play context of the same name hides that object where the click is",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nconst context = { userEvent: browserUserEvent };\nconst user = slow ? context.userEvent : context.userEvent;\nexport const Story = {\n  play: async (context) => {\n    await user.click(input);\n    await user.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'reassigned-context-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of a play context that the play reassigns, is removed',
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async (context) => {\n    context = { userEvent: browserUserEvent };\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'reassigned-context-user-event-click-before-type',
    title:
      "a click directly before a type on the same target, both on the context's userEvent destructured under another name that the play reassigns, is removed",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async ({ userEvent: user }) => {\n    user = browserUserEvent;\n    await user.click(input);\n    await user.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'written-context-user-event-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of a play context whose userEvent the play writes, is removed',
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async (context) => {\n    context.userEvent = browserUserEvent;\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'hook-written-user-event-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach writes the context's userEvent, as Storybook runs it on the same context first",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport default {\n  beforeEach: (context) => {\n    context.userEvent = browserUserEvent;\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'named-play-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of the context of a play given by its name, is removed, as only a play given inline is read',
    source: `const fillForm = async (context) => {\n  await context.userEvent.click(input);\n  await context.userEvent.type(input, 'a');\n};\nexport const Story = {\n  play: fillForm,\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'assigned-play-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of the context of a play assigned as Story.play, is removed, as only a play given inline is read',
    source: `export const Story = {};\nStory.play = async (context) => {\n  await context.userEvent.click(input);\n  await context.userEvent.type(input, 'a');\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'step-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the userEvent of a step callback's context, is removed, as only a play's context is read",
    source: `export const Story = {\n  play: async ({ step }) => {\n    await step('Fill', async (context) => {\n      await context.userEvent.click(input);\n      await context.userEvent.type(input, 'a');\n    });\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
];
