import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  inPlay,
  interactionsIn,
  type KindCase,
} from './support/interactions.ts';
import { inPlayWith } from './support/story-source.ts';

const originCases: readonly KindCase[] = [
  {
    title: "a click on the play context's userEvent is a user-event 14 click",
    source: inPlay("await userEvent.click(canvas.getByRole('button'));"),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "a call on another context key destructured under a user-event's name is no interaction",
    source: inPlayWith(
      ['canvas', 'driver: user'],
      "await user.click(canvas.getByRole('button'));",
    ),
    expect: [],
  },
  {
    title:
      "a click on a userEvent destructured from a local function's parameter is a user-event click of unproven origin",
    source: inPlayWith(
      ['canvas'],
      'const fill = async ({ userEvent }) => {',
      "  await userEvent.click(canvas.getByRole('textbox'));",
      '};',
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the play context's userEvent after an assignment to it inside an as expression is of unproven origin",
    source: inPlay(
      '(userEvent as typeof vitestUserEvent) = vitestUserEvent;',
      "await userEvent.click(canvas.getByRole('textbox'));",
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the play context's userEvent after an update of it under a non-null assertion is of unproven origin",
    source: inPlay(
      'userEvent!++;',
      "await userEvent.click(canvas.getByRole('textbox'));",
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the play context's userEvent after a for...of head writes it inside a satisfies expression is of unproven origin",
    source: inPlay(
      'for ((userEvent satisfies object) of [vitestUserEvent]) {}',
      "await userEvent.click(canvas.getByRole('textbox'));",
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the play context's userEvent after a destructuring assignment writes it inside an as expression is of unproven origin",
    source: inPlay(
      '({ userEvent: userEvent as object } = { userEvent: vitestUserEvent });',
      "await userEvent.click(canvas.getByRole('textbox'));",
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the play context's userEvent that a play parameter's default writes is of unproven origin",
    source: `export const Story = {\n  play: async ({ canvas, userEvent }, driver = (userEvent = vitestUserEvent)) => {\n    await userEvent.click(canvas.getByRole('textbox'));\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on userEvent that a var in a nested block hoists over a storybook/test import is of unproven origin',
    source: `import { userEvent } from 'storybook/test';\n${inPlayWith(
      ['canvas'],
      'if (open) {',
      '  var userEvent = vitestUserEvent;',
      '}',
      "await userEvent.click(canvas.getByRole('textbox'));",
    )}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on userEvent that a var in a for...of head hoists over a storybook/test import is of unproven origin',
    source: `import { userEvent } from 'storybook/test';\n${inPlayWith(
      ['canvas'],
      'for (var userEvent of [vitestUserEvent]) {}',
      "await userEvent.click(canvas.getByRole('textbox'));",
    )}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on a userEvent that a const in a class static block declares over a storybook/test import is of unproven origin',
    source: [
      "import { userEvent } from 'storybook/test';",
      'class Steps {',
      '  static {',
      '    const userEvent = vitestUserEvent;',
      '    userEvent.click(textbox);',
      '  }',
      '}',
    ].join('\n'),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on a storybook/test import renamed and a setup() local in a TypeScript namespace are user-event 14 interactions',
    source: [
      "import { userEvent as ue } from 'storybook/test';",
      'namespace Steps {',
      '  export async function save() {',
      '    await ue.click(a);',
      '    const user = ue.setup();',
      "    await user.type(a, 'x');",
      '  }',
      '}',
    ].join('\n'),
    expect: ['userEvent click userEvent14', 'userEvent type userEvent14'],
  },
  {
    title:
      'a click on a named class expression called userEvent, inside that class, is of unproven origin',
    source: [
      "import { userEvent } from 'storybook/test';",
      'const Steps = class userEvent {',
      '  open() {',
      '    userEvent.click(button);',
      '  }',
      '};',
    ].join('\n'),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on a local bound to userEvent.setup() that a class static block shadows is a user-event 14 click',
    source: `import { userEvent } from 'storybook/test';\n${inPlayWith(
      ['canvas'],
      'const user = userEvent.setup();',
      'class Steps {',
      '  static {',
      '    const user = 1;',
      '  }',
      '}',
      "await user.click(canvas.getByRole('textbox'));",
    )}`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "a let in a for...of head shadows the play context's userEvent only inside the loop",
    source: inPlay(
      'for (let userEvent of [vitestUserEvent]) {',
      "  await userEvent.click(canvas.getByRole('textbox'));",
      '}',
      "await userEvent.click(canvas.getByRole('textbox'));",
    ),
    expect: ['userEvent click unproven', 'userEvent click userEvent14'],
  },
  {
    title:
      "a const in a for...of head shadows the play context's userEvent only inside the loop",
    source: inPlay(
      'for (const userEvent of [vitestUserEvent]) {',
      "  await userEvent.click(canvas.getByRole('textbox'));",
      '}',
      "await userEvent.click(canvas.getByRole('textbox'));",
    ),
    expect: ['userEvent click unproven', 'userEvent click userEvent14'],
  },
  {
    title:
      "a click on userEvent imported under another name from 'vitest/browser' is a Vitest browser click",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\n${inPlay("await browserUserEvent.click(canvas.getByRole('button'));")}`,
    expect: ['userEvent click vitestBrowser'],
  },
  {
    title:
      "a click on userEvent imported under another name from 'storybook/test' is a user-event 14 click",
    source: `import { userEvent as ue } from 'storybook/test';\n${inPlay("await ue.click(canvas.getByRole('button'));")}`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "a click on the default import of '@testing-library/user-event' under another name is a user-event 14 click",
    source: `import ue from '@testing-library/user-event';\n${inPlay("await ue.click(canvas.getByRole('button'));")}`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "a click on the default export of '@testing-library/user-event' imported by the string name 'default' is a user-event 14 click",
    source: `import { 'default' as ev } from '@testing-library/user-event';\n${inPlayWith(['canvas'], "await ev.click(canvas.getByRole('button'));")}`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "a click on the default import of 'storybook/test' under another name is no interaction, as only '@testing-library/user-event' has a user-event default export",
    source: `import ue from 'storybook/test';\n${inPlayWith(['canvas'], "await ue.click(canvas.getByRole('button'));")}`,
    expect: [],
  },
  {
    title:
      "a click on the default import of 'storybook/test' named userEvent is a user-event click of unproven origin",
    source: `import userEvent from 'storybook/test';\n${inPlayWith(['canvas'], "await userEvent.click(canvas.getByRole('button'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the default import of 'vitest/browser' named userEvent is a user-event click of unproven origin, as only its named userEvent export is Vitest browser's",
    source: `import userEvent from 'vitest/browser';\n${inPlayWith(['canvas'], "await userEvent.click(canvas.getByRole('button'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on userEvent imported under another name from a module that is no user-event module is no interaction',
    source: `import { userEvent as u } from './test-utils';\n${inPlayWith(['canvas'], "await u.click(canvas.getByRole('button'));")}`,
    expect: [],
  },
  {
    title:
      "a click on another export of 'vitest/browser' imported under a user-event's name is no interaction",
    source: `import { page as user } from 'vitest/browser';\n${inPlay("await user.click(canvas.getByRole('button'));")}`,
    expect: [],
  },
  {
    title:
      "a click on userEvent imported by name from '@vitest/browser/context' is a Vitest browser click",
    source: `import { userEvent } from '@vitest/browser/context';\n${inPlayWith(['canvas'], "await userEvent.click(canvas.getByRole('button'));")}`,
    expect: ['userEvent click vitestBrowser'],
  },
  {
    title:
      "a click on the default member of a namespace import of '@testing-library/user-event' is a user-event 14 click",
    source: `import * as ue from '@testing-library/user-event';\n${inPlayWith(['canvas'], "await ue.default.click(canvas.getByRole('button'));")}`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "a click on the userEvent of a namespace import of 'vitest/browser' is a Vitest browser click",
    source: `import * as browser from 'vitest/browser';\n${inPlay("await browser.userEvent.click(canvas.getByRole('button'));")}`,
    expect: ['userEvent click vitestBrowser'],
  },
  {
    title:
      "a call on the default member of a namespace import of 'storybook/test' is no interaction",
    source: `import * as ue from 'storybook/test';\n${inPlayWith(['canvas'], "await ue.default.click(canvas.getByRole('button'));")}`,
    expect: [],
  },
  {
    title:
      "a call on the default member of a play parameter that shadows a namespace import of '@testing-library/user-event' is no interaction",
    source: `import * as ue from '@testing-library/user-event';\n${inPlayWith(['canvas', 'ue'], "await ue.default.click(canvas.getByRole('button'));")}`,
    expect: [],
  },
  {
    title:
      "a click on the default member of a namespace import of '@testing-library/user-event' inside an as expression is a user-event 14 click",
    source: `import * as ue from '@testing-library/user-event';\n${inPlayWith(['canvas'], "await (ue as any).default.click(canvas.getByRole('button'));")}`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a type on the userEvent member of the play context is a user-event 14 type',
    source: `export const Story = {\n  play: async (context) => {\n    await context.userEvent.type(context.canvas.getByRole('textbox'), 'a');\n  },\n};\n`,
    expect: ['userEvent type userEvent14'],
  },
  {
    title:
      'a click on the userEvent member of something other than a play context is a user-event click of unproven origin',
    source: inPlayWith(
      ['canvas'],
      "await helpers.userEvent.click(canvas.getByRole('button'));",
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the userEvent member of a local holding a function's result is a user-event click of unproven origin",
    source: inPlayWith(
      ['canvas'],
      'const foo = makeDriver();',
      "await foo.userEvent.click(canvas.getByRole('button'));",
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on the userEvent member of an optional play context is a user-event 14 click',
    source: `export const Story = {\n  play: async (context) => {\n    await context?.userEvent.click(button);\n  },\n};\n`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "an optional click on the play context's userEvent is a user-event 14 click",
    source: inPlay('await userEvent?.click(input);'),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a click on the userEvent member of a play context that the play assigns is of unproven origin',
    source: `export const Story = {\n  play: async (context) => {\n    context = driverContext;\n    await context.userEvent.click(button);\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the play context's userEvent member after the play assigns that member is of unproven origin",
    source: `export const Story = {\n  play: async (context) => {\n    context.userEvent = vitestUserEvent;\n    await context.userEvent.click(context.canvas.getByRole('button'));\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on userEvent destructured from the play context after the play passes the context to a call is of unproven origin',
    source: `export const Story = {\n  play: async (context) => {\n    Object.assign(context, { userEvent: vitestUserEvent });\n    const { userEvent } = context;\n    await userEvent.click(context.canvas.getByRole('button'));\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the play context's userEvent member after the play assigns that member through an alias of the context is of unproven origin",
    source: `export const Story = {\n  play: async (context) => {\n    const driver = context;\n    driver.userEvent = vitestUserEvent;\n    await context.userEvent.click(button);\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the play context's userEvent member after the play assigns that member's click is of unproven origin",
    source: `export const Story = {\n  play: async (context) => {\n    context.userEvent.click = fake;\n    await context.userEvent.click(button);\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on a let destructured under another name from the play context and then assigned is of unproven origin',
    source: `export const Story = {\n  play: async (context) => {\n    let { userEvent: u } = context;\n    u = other;\n    await u.click(button);\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on userEvent destructured from the play context after the play assigns its click is of unproven origin',
    source: `export const Story = {\n  play: async (context) => {\n    const { userEvent } = context;\n    userEvent.click = fake;\n    await userEvent.click(button);\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the play context's userEvent destructured under another name with a default is a user-event 14 click",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async ({ userEvent: user = browserUserEvent }) => {\n    await user.click(button);\n  },\n};\n`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "a click on a story test's context userEvent destructured under another name is a user-event 14 click",
    source: `export const Story = meta.story({});\nStory.test('clicks', async ({ canvas, userEvent: user }) => {\n  await user.click(canvas.getByRole('button'));\n});\n`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a call on a local bound to the setup() of the play context userEvent is a user-event 14 call',
    source: inPlay(
      'const user = userEvent.setup();',
      "await user.keyboard('{Enter}');",
    ),
    expect: ['userEvent keyboard userEvent14'],
  },
  {
    title:
      'a click on a local bound to userEvent.setup() after the play assigns its click is of unproven origin',
    source: inPlay(
      'const user = userEvent.setup();',
      'user.click = fake;',
      'await user.click(button);',
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a call on a local bound to an awaited userEvent.setup() is a user-event 14 call',
    source: inPlay(
      'const user = await userEvent.setup();',
      'await user.click(button);',
    ),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a click on the setup() of the play context userEvent itself is a user-event 14 click',
    source: inPlay('await userEvent.setup().click(button);'),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a click on the awaited setup() of the play context userEvent itself is a user-event 14 click',
    source: inPlay('await (await userEvent.setup()).click(button);'),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a click on the setup() of a local that is no user-event is no interaction',
    source: inPlay('await driver.setup().click(button);'),
    expect: [],
  },
  {
    title: 'a call on a let bound to userEvent.setup() is a user-event 14 call',
    source: inPlay(
      'let user = userEvent.setup();',
      "await user.click(canvas.getByRole('button'));",
    ),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a call on a let assigned userEvent.setup() once is a user-event 14 call',
    source: inPlay(
      'let user;',
      'user = userEvent.setup();',
      "await user.keyboard('{Enter}');",
    ),
    expect: ['userEvent keyboard userEvent14'],
  },
  {
    title:
      "a call on a let declared outside the play and assigned there the setup() of the context's userEvent destructured under another name is a user-event 14 call",
    source: `let user;\nexport const Story = {\n  play: async ({ userEvent: pointer }) => {\n    user = pointer.setup();\n    await user.click(button);\n  },\n};\n`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a call on a let reassigned after userEvent.setup() is no interaction',
    source: inPlay(
      'let user = userEvent.setup();',
      'user = createDriver();',
      "await user.keyboard('{Enter}');",
    ),
    expect: [],
  },
  {
    title:
      "a call on a local bound to the play context's userEvent.setup() is a user-event 14 call",
    source: `export const Story = {\n  play: async (context) => {\n    const user = context.userEvent.setup();\n    await user.click(button);\n  },\n};\n`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "a call on a local bound to the setup() of userEvent imported under another name from 'vitest/browser' is a Vitest browser call",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\n${inPlay('const user = browserUserEvent.setup();', 'await user.click(button);')}`,
    expect: ['userEvent click vitestBrowser'],
  },
  {
    title:
      'a call on a let given userEvent.setup() and then each value of a for...of is no interaction',
    source: inPlay(
      'let user = userEvent.setup();',
      'for (user of drivers) {}',
      "await user.keyboard('{Enter}');",
    ),
    expect: [],
  },
  {
    title:
      "a call on a setup instance from a helper's return value is no interaction",
    source: inPlay(
      'const { user } = await openMenu(canvas);',
      "await user.click(canvas.getByRole('button'));",
    ),
    expect: [],
  },
  {
    title:
      'a call on a local bound to the result of a userEvent method other than setup() is no interaction',
    source: inPlay(
      'const user = userEvent.create();',
      "await user.click(canvas.getByRole('button'));",
    ),
    expect: [],
  },
  {
    title:
      "a call on a local bound to the setup() of the default member of a namespace import of '@testing-library/user-event' is a user-event 14 call",
    source: `import * as ue from '@testing-library/user-event';\n${inPlayWith(['canvas'], 'const user = ue.default.setup();', "await user.click(canvas.getByRole('button'));")}`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title: 'a call on a var given its own setup() is no interaction',
    source: inPlay('var user = user.setup();', 'await user.click(button);'),
    expect: [],
  },
  {
    title: 'a userEvent.setup() statement is no interaction',
    source: inPlay('userEvent.setup();'),
    expect: [],
  },
  {
    title:
      'a call of a user-event method name on a member other than userEvent, such as window.localStorage.clear(), is no interaction',
    source: inPlay('window.localStorage.clear();'),
    expect: [],
  },
  {
    title:
      "a call on another context key destructured beside the context's userEvent is no interaction",
    source: inPlayWith(
      ['canvas', 'userEvent', 'driver'],
      "await driver.click(canvas.getByRole('button'));",
    ),
    expect: [],
  },
  {
    title:
      "a click on userEvent destructured under another name from import('vitest/browser') is a Vitest browser click",
    source: inPlay(
      "const { userEvent: trustedUserEvent } = await import('vitest/browser');",
      "await trustedUserEvent.click(canvas.getByRole('button'));",
    ),
    expect: ['userEvent click vitestBrowser'],
  },
  {
    title:
      'a click on userEvent destructured under another name from the play context in the play is a user-event 14 click',
    source: `export const Story = {\n  play: async (context) => {\n    const { userEvent: user } = context;\n    await user.click(button);\n  },\n};\n`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a click on userEvent destructured from the play context in the play, beside member reads of the context, is a user-event 14 click',
    source: `export const Story = {\n  play: async (context) => {\n    const { userEvent } = context;\n    await userEvent.click(context.canvas.getByRole('button'));\n  },\n};\n`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "a hover on userEvent destructured under another name from import('@vitest/browser/context') is a Vitest browser hover",
    source: inPlay(
      "const { userEvent: pointer } = await import('@vitest/browser/context');",
      "await pointer.hover(canvas.getByRole('button'));",
    ),
    expect: ['userEvent hover vitestBrowser'],
  },
  {
    title:
      "a click on another member of import('vitest/browser') destructured under a user-event's name is no interaction",
    source: inPlay(
      "const { page: trustedUserEvent } = await import('vitest/browser');",
      "await trustedUserEvent.click(canvas.getByRole('button'));",
    ),
    expect: [],
  },
  {
    title:
      "a click on userEvent destructured from a local holding a function's result is a user-event click of unproven origin",
    source: inPlayWith(
      ['canvas'],
      'const foo = makeDriver();',
      'const { userEvent } = foo;',
      "await userEvent.click(canvas.getByRole('button'));",
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on userEvent destructured under another name from a local holding a function's result is a user-event click of unproven origin",
    source: inPlayWith(
      ['canvas'],
      'const foo = makeDriver();',
      'const { userEvent: u } = foo;',
      "await u.click(canvas.getByRole('button'));",
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a hover on userEvent destructured from another module's import() is a user-event hover of unproven origin",
    source: inPlay(
      "const { userEvent: pointer } = await import('./driver');",
      "await pointer.hover(canvas.getByRole('button'));",
    ),
    expect: ['userEvent hover unproven'],
  },
  {
    title:
      'a click on userEvent destructured from the play context after the play assigns the context is of unproven origin',
    source: `export const Story = {\n  play: async (context) => {\n    context = driverContext;\n    const { userEvent: user } = context;\n    await user.click(button);\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the userEvent member of import('vitest/browser') is a Vitest browser click",
    source: inPlay(
      "await (await import('vitest/browser')).userEvent.click(canvas.getByRole('button'));",
    ),
    expect: ['userEvent click vitestBrowser'],
  },
  {
    title:
      'a click on a local that is one of two play context userEvents is a user-event 14 click',
    source: inPlay(
      'const pointer = flag ? userEvent : userEvent;',
      "await pointer.click(canvas.getByRole('button'));",
    ),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "a hover on a local that is import('vitest/browser')'s userEvent or the play context's is a user-event hover of unproven origin",
    source: inPlay(
      "const pointer = '__vitest_browser__' in globalThis ? (await import('vitest/browser')).userEvent : userEvent;",
      "await pointer.hover(canvas.getByRole('button'));",
    ),
    expect: ['userEvent hover unproven'],
  },
  {
    title:
      'a click on a local that is userEvent or something else is no interaction',
    source: inPlay(
      'const pointer = flag ? userEvent : driver;',
      "await pointer.click(canvas.getByRole('button'));",
    ),
    expect: [],
  },
  {
    title:
      'a click on a var given a choice between itself and userEvent is no interaction',
    source: inPlay(
      'var user = flag ? user : userEvent;',
      'await user.click(button);',
    ),
    expect: [],
  },
  {
    title:
      'a click on a let assigned a choice between itself and userEvent is no interaction',
    source: inPlay(
      'let user;',
      'user = flag ? user : userEvent;',
      'await user.click(button);',
    ),
    expect: [],
  },
  {
    title:
      "a click on a local that aliases the play context's userEvent is a user-event 14 click",
    source: inPlay(
      'const u = userEvent;',
      "await u.click(canvas.getByRole('button'));",
    ),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "a click on a local that aliases the play context's userEvent after the play assigns its click is of unproven origin",
    source: inPlay(
      'const u = userEvent;',
      'u.click = fake;',
      "await u.click(canvas.getByRole('button'));",
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on a local that aliases a local aliasing a Vitest browser import is a Vitest browser click',
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\n${inPlayWith(['canvas'], 'const first = browserUserEvent;', 'const second = first;', "await second.click(canvas.getByRole('button'));")}`,
    expect: ['userEvent click vitestBrowser'],
  },
  {
    title:
      'a click on one of two locals that alias each other is no interaction',
    source: inPlay(
      'var first = second;',
      'var second = first;',
      "await second.click(canvas.getByRole('button'));",
    ),
    expect: [],
  },
  {
    title:
      'a click on the last of 40 locals that each give the one before or itself is a user-event 14 click',
    source: inPlay(
      'const u0 = userEvent;',
      ...Array.from(
        { length: 40 },
        (_, i) => `const u${i + 1} = u${i} || u${i};`,
      ),
      "await u40.click(canvas.getByRole('button'));",
    ),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a click on the last of 40 locals that each choose between the one before and itself is a user-event 14 click',
    source: inPlay(
      'const u0 = userEvent;',
      ...Array.from(
        { length: 40 },
        (_, i) => `const u${i + 1} = flag ? u${i} : u${i};`,
      ),
      "await u40.click(canvas.getByRole('button'));",
    ),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "a click on the play context's userEvent destructured from a context parameter with a default is a user-event 14 click",
    source: `export const Story = {\n  play: async ({ canvas, userEvent } = {}) => {\n    await userEvent.click(canvas.getByRole('button'));\n  },\n};\n`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "a click on userEvent destructured from a play's second parameter is a user-event click of unproven origin",
    source: `export const Story = {\n  play: async (context, { userEvent }) => {\n    await userEvent.click(button);\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on the userEvent member of another key destructured from the play context is a user-event click of unproven origin',
    source: inPlayWith(
      ['canvas', 'driver'],
      "await driver.userEvent.click(canvas.getByRole('button'));",
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on the userEvent member of a play context that a computed key also reads is of unproven origin',
    source: `export const Story = {\n  play: async (context) => {\n    await context.userEvent.click(buttons[context]);\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on the parameter of an object method keyed userEvent is no interaction',
    source:
      'const steps = {\n  userEvent(user) {\n    user.click(button);\n  },\n};\n',
    expect: [],
  },
  {
    title:
      "a click on the userEvent member of a named import from 'vitest/browser' is a user-event click of unproven origin",
    source: `import { browser } from 'vitest/browser';\n${inPlayWith(['canvas'], "await browser.userEvent.click(canvas.getByRole('button'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on userEvent destructured under another name in a catch clause is no interaction',
    source: inPlayWith(
      ['canvas'],
      'try {',
      '  await open();',
      '} catch ({ userEvent: user }) {',
      "  await user.click(canvas.getByRole('button'));",
      '}',
    ),
    expect: [],
  },
  {
    title:
      "a click on a local given a sequence whose last of three values is the play context's userEvent is a user-event 14 click",
    source: inPlay(
      'const pointer = (log(), driver, userEvent);',
      "await pointer.click(canvas.getByRole('button'));",
    ),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a click on a local bound to a new expression of userEvent.setup is no interaction',
    source: inPlay(
      'const user = new userEvent.setup();',
      'await user.click(button);',
    ),
    expect: [],
  },
  {
    title: 'a click on a let given userEvent only by += is no interaction',
    source: inPlay(
      'let user;',
      'user += userEvent;',
      'await user.click(button);',
    ),
    expect: [],
  },
];

describe('interactionsOf origins', () => {
  originCases.forEach(({ title, source, expect }) => {
    it(title, () => {
      assert.deepEqual(interactionsIn(source), [expect, expect]);
    });
  });
});
