import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { csfShapes } from '../src/csf.ts';
import { type Interaction, interactionsOf } from '../src/interactions.ts';
import { field } from '../src/node-field.ts';
import { descendants, memberName } from '../src/node-tree.ts';
import { programsOf } from './support/parse-module.ts';

interface KindCase {
  readonly title: string;
  readonly source: string;
  /** Each interaction of the file, in source order, as `describeInteraction` gives it. */
  readonly expect: readonly string[];
}

/** The play of a story that destructures `contextKeys` from its context and runs `statements`. */
function inPlayWith(
  contextKeys: readonly string[],
  ...statements: readonly string[]
): string {
  return `export const Story = {\n  play: async ({ ${contextKeys.join(', ')} }) => {\n    ${statements.join('\n    ')}\n  },\n};\n`;
}

function inPlay(...statements: readonly string[]): string {
  return inPlayWith(['canvas', 'userEvent'], ...statements);
}

/** The kind of an interaction, with its method (`?` for an unknown key), its user-event origin, a step body site and a hook. */
function describeInteraction(interaction: Interaction): string {
  return [
    interaction.kind,
    ...(interaction.kind === 'userEvent' || interaction.kind === 'fireEvent'
      ? [interaction.method ?? '?']
      : []),
    ...(interaction.kind === 'userEvent' ? [interaction.origin] : []),
    ...(interaction.site === 'stepBody' ? ['stepBody'] : []),
    ...(interaction.inHook ? ['inHook'] : []),
  ].join(' ');
}

/** The interactions of `source`, described, once per parse. */
function interactionsIn(source: string): readonly (readonly string[])[] {
  return programsOf(source).map((program) =>
    interactionsOf(program, csfShapes(program)).all.map(describeInteraction),
  );
}

const kindCases: readonly KindCase[] = [
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
      "a click by a string-literal computed key on the play context's userEvent is a user-event 14 click",
    source: inPlay("await userEvent['click'](canvas.getByRole('button'));"),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "a call by an unknown computed key on the play context's userEvent is a user-event interaction of unknown method",
    source: inPlay("await userEvent[method](canvas.getByRole('button'));"),
    expect: ['userEvent ? userEvent14'],
  },
  {
    title:
      "a string-literal computed key that names no page-acting method, such as userEvent['setup'](), is no interaction",
    source: inPlay("userEvent['setup']();"),
    expect: [],
  },
  {
    title: 'a click on userEvent inside an as expression is a user-event click',
    source: inPlay('await (userEvent as any).click(button);'),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a click on userEvent inside a satisfies expression is a user-event click',
    source: inPlay('await (userEvent satisfies object).click(button);'),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a click on userEvent inside an angle-bracket type assertion is a user-event click',
    source: inPlay('await (<any>userEvent).click(button);'),
    expect: ['userEvent click userEvent14'],
  },
  {
    title: 'an awaited interaction inside an as expression is an interaction',
    source: inPlay('await (userEvent.click(button) as Promise<void>);'),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'an await of an interaction inside an as expression is an interaction',
    source: inPlay('(await userEvent.click(button)) as unknown;'),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "a click in the meta's play is the play context's user-event 14 click",
    source: `export default {\n  play: async ({ userEvent }) => {\n    await userEvent.click(button);\n  },\n};\nexport const Story = {};\n`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title: "an interaction in a play method is the play context's",
    source: `export const Story = {\n  async play({ userEvent }) {\n    await userEvent.click(button);\n  },\n};\n`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a click on an unbound userEvent outside any function is a user-event click of unproven origin',
    source: 'await userEvent.click(button);\nexport const Story = {};\n',
    expect: ['userEvent click unproven'],
  },
  {
    title: "a click in a play assigned to a story is the play context's",
    source: `export const Story = {};\nStory.play = async ({ userEvent }) => {\n  await userEvent.click(button);\n};\n`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a click in a function under a computed key, which need not be play, is of unproven origin',
    source: `const play = 'x';\nexport default { title: 'Form' };\nexport const Form = {\n  [play]: async ({ canvas, userEvent }) => {\n    await userEvent.click(canvas.getByRole('textbox'));\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title: 'an awaited fireEvent.click statement is a fireEvent click',
    source: inPlay("await fireEvent.click(canvas.getByRole('button'));"),
    expect: ['fireEvent click'],
  },
  {
    title:
      'a fireEvent(element, event) statement is a fireEvent of unknown event',
    source: inPlay(
      "fireEvent(canvas.getByRole('button'), new MouseEvent('click'));",
    ),
    expect: ['fireEvent ?'],
  },
  {
    title:
      'a fireEvent.click on fireEvent inside an as expression is a fireEvent click',
    source: inPlay('await (fireEvent as any).click(button);'),
    expect: ['fireEvent click'],
  },
  {
    title: "another story's play called with the context is a composed play",
    source: `export const Other = { play: async () => {} };\nexport const Story = {\n  play: async (context) => {\n    await Other.play(context);\n  },\n};\n`,
    expect: ['composedPlay'],
  },
  {
    title: "a video's play() in a story's render is no interaction",
    source: `export const Story = {\n  render: () => {\n    useEffect(() => {\n      video.play();\n    });\n    return null;\n  },\n};\n`,
    expect: [],
  },
  {
    title: "a step that runs another story's play is a composed play",
    source: `export const Other = { play: async () => {} };\nexport const Story = {\n  play: async ({ step }) => {\n    await step('Enter value', Other.play);\n  },\n};\n`,
    expect: ['composedPlay'],
  },
  {
    title: "a context.step that runs another story's play is a composed play",
    source: `export const Other = { play: async () => {} };\nexport const Story = {\n  play: async (context) => {\n    await context.step('Enter value', Other.play);\n  },\n};\n`,
    expect: ['composedPlay'],
  },
  ...[
    'Stories.Other.play(context)',
    "Stories['Other'].play(context)",
    'Stories?.Other.play(context)',
    'meta.play?.(context)',
    'Other.play!(context)',
    'Other.run()',
  ].map((call) => ({
    title: `${call} in a play is a composed play`,
    source: `import * as Stories from './Other.stories';\nconst meta = {};\nexport default meta;\nexport const Story = {\n  play: async (context) => {\n    await ${call};\n  },\n};\n`,
    expect: ['composedPlay'],
  })),
  ...['Stories.Other.play', 'Stories?.Other.play', 'Other.play!'].map(
    (play) => ({
      title: `a step given ${play} is a composed play`,
      source: `import * as Stories from './Other.stories';\nexport const Story = {\n  play: async ({ step }) => {\n    await step('Enter value', ${play});\n  },\n};\n`,
      expect: ['composedPlay'],
    }),
  ),
  {
    title: 'a composed play in a play function assigned to the story is one',
    source: `export const Other = { play: async () => {} };\nexport const Story = {};\nStory.play = async (context) => {\n  await Other.play(context);\n};\n`,
    expect: ['composedPlay'],
  },
  {
    title:
      "a call other than step given another story's play is no interaction",
    source: `export const Other = { play: async () => {} };\nexport const Story = {\n  play: async () => {\n    await runPlay('Enter value', Other.play);\n  },\n};\n`,
    expect: [],
  },
  {
    title: 'a step given a function other than a play is no interaction',
    source: inPlayWith(['step'], "await step('Open menu', helpers.openMenu);"),
    expect: [],
  },
  {
    title: 'a step given only its label is no interaction',
    source: inPlayWith(['step'], "await step('Open menu');"),
    expect: [],
  },
  {
    title:
      'a step given the play of a receiver that is no identifier or member chain starting at one is no interaction',
    source: inPlayWith(
      ['canvas', 'step'],
      "await step('Start', canvas.getByTestId('video').play);",
    ),
    expect: [],
  },
  {
    title:
      'a play() call on a receiver that is no identifier or member chain starting at one is no interaction',
    source: inPlay("await canvas.getByTestId('video').play();"),
    expect: [],
  },
  {
    title:
      "an interaction on a parameter's userEvent in a play property defined inside a play is of unproven origin, and the call of that play is a composed play",
    source: inPlay(
      'const inner = {',
      '  play: async (page) => {',
      '    await page.userEvent.click(input);',
      '  },',
      '};',
      'await inner.play({});',
    ),
    expect: ['userEvent click unproven', 'composedPlay'],
  },
  {
    title:
      "a video's play() in a play property of an object a render builds is no interaction",
    source: `export const Story = {\n  render: () => {\n    const player = {\n      play: () => {\n        video.play();\n      },\n    };\n    return player;\n  },\n};\n`,
    expect: [],
  },
  {
    title: "a raw DOM element's click() statement is a raw DOM interaction",
    source: inPlay('button.click();'),
    expect: ['rawDom'],
  },
  ...['blur()', "dispatchEvent(new Event('input'))"].map((call) => ({
    title: `a raw DOM element's ${call} statement is a raw DOM interaction`,
    source: inPlay(`button.${call};`),
    expect: ['rawDom'],
  })),
  {
    title: "a raw DOM element's focus() statement is a raw DOM interaction",
    source: inPlay("canvas.getByRole('textbox').focus();"),
    expect: ['rawDom'],
  },
  {
    title:
      'a click with an argument on a receiver that is no user-event is no interaction',
    source: inPlay("await helper.click(canvas.getByRole('button'));"),
    expect: [],
  },
  {
    title: "a raw DOM element's click() in a story test's body is one",
    source: `export const Story = meta.story({});\nStory.test('clicks', async () => {\n  button.click();\n});\n`,
    expect: ['rawDom'],
  },
  {
    title:
      "a raw DOM element's click() in a play function declared in the file and given by name is one",
    source: `const play = async () => {\n  button.click();\n};\nexport const Story = { play };\n`,
    expect: ['rawDom'],
  },
  {
    title:
      "a raw DOM element's click() in a play function assigned to the story is one",
    source: `export const Story = {};\nStory.play = async () => {\n  button.click();\n};\n`,
    expect: ['rawDom'],
  },
  {
    title: "a raw DOM element's focus() in a story's render is no interaction",
    source: `export const Story = {\n  render: () => {\n    input.focus();\n    return null;\n  },\n};\n`,
    expect: [],
  },
  {
    title:
      "a userEvent click and a fireEvent click in a story's render are interactions, where a raw DOM click is none",
    source: `import { userEvent, fireEvent } from 'storybook/test';\nexport const Story = {\n  render: () => {\n    userEvent.click(document.body);\n    fireEvent.click(document.body);\n    document.body.click();\n    return null;\n  },\n};\n`,
    expect: ['userEvent click userEvent14', 'fireEvent click'],
  },
  {
    title:
      "a raw DOM element's dispatchEvent(event) in a decorator is no interaction",
    source: `export default {\n  decorators: [\n    (Story) => {\n      window.dispatchEvent(new Event('resize'));\n      return Story();\n    },\n  ],\n};\n`,
    expect: [],
  },
  {
    title:
      "a raw DOM element's click() in a .test() body of a story the file does not export is no interaction",
    source: `const Story = meta.story({});\nStory.test('clicks', async () => {\n  button.click();\n});\n`,
    expect: [],
  },
  {
    title:
      "a raw DOM element's click() in a later .test() body with the same name is no interaction",
    source: `export const Story = meta.story({});\nStory.test('clicks', async () => {});\nStory.test('clicks', async () => {\n  button.click();\n});\n`,
    expect: [],
  },
  {
    title:
      "a raw DOM element's click() in the play of an export that excludeStories leaves out is no interaction",
    source: `export default { excludeStories: ['helper'] };\nexport const helper = {\n  play: async () => {\n    button.click();\n  },\n};\n`,
    expect: [],
  },
  {
    title:
      'an interaction that is the expression body of a step callback stands at a step body site',
    source: `export const Story = {\n  play: async ({ step, userEvent }) => {\n    await step('Submit', () => userEvent.click(button));\n  },\n};\n`,
    expect: ['userEvent click userEvent14 stepBody'],
  },
  {
    title: 'a new expression of a user-event method is no interaction',
    source: inPlay('new userEvent.click(button);'),
    expect: [],
  },
  {
    title:
      'an interaction that is the expression body of a context.step callback stands at a step body site',
    source: `export const Story = {\n  play: async (context) => {\n    await context.step('Submit', () => context.userEvent.click(button));\n  },\n};\n`,
    expect: ['userEvent click userEvent14 stepBody'],
  },
  {
    title:
      'an interaction inside a call given to step, which is no step callback body, is no interaction',
    source: inPlayWith(
      ['step', 'userEvent'],
      "await step('Submit', wrap(userEvent.click(button)));",
    ),
    expect: [],
  },
  {
    title:
      'an interaction that is the expression body of an arrow held in a local is no interaction site',
    source: inPlay(
      'const clickSave = () => userEvent.click(save);',
      'await clickSave();',
    ),
    expect: [],
  },
  {
    title:
      'an interaction that is the expression body of an arrow given to a method other than step is no interaction site',
    source: inPlay('buttons.forEach((button) => userEvent.click(button));'),
    expect: [],
  },
  {
    title:
      'an interaction that is the expression body of an arrow given to step on a member of a member is no interaction site',
    source: inPlay(
      "await story.context.step('Submit', () => userEvent.click(button));",
    ),
    expect: [],
  },
  {
    title: 'an interaction in a beforeEach stands in a hook',
    source: `export const Story = {\n  beforeEach: async ({ userEvent }) => {\n    await userEvent.click(button);\n  },\n};\n`,
    expect: ['userEvent click userEvent14 inHook'],
  },
  {
    title: 'an interaction in an afterEach method stands in a hook',
    source: `export default {\n  async afterEach() {\n    button.blur();\n  },\n};\n`,
    expect: ['rawDom inHook'],
  },
  {
    title: 'an interaction in a beforeEach given in an array stands in a hook',
    source: `export const Story = {\n  beforeEach: [\n    async ({ userEvent }) => {\n      await userEvent.click(button);\n    },\n  ],\n};\n`,
    expect: ['userEvent click unproven inHook'],
  },
  {
    title:
      'an interaction in a function declared in the file and given as a beforeEach stands in a hook',
    source: `async function setup({ userEvent }) {\n  await userEvent.click(button);\n}\nexport default {\n  beforeEach: setup,\n};\n`,
    expect: ['userEvent click userEvent14 inHook'],
  },
  {
    title:
      'an interaction in an arrow held in a local and given as a beforeEach stands in a hook',
    source: `const setup = async ({ userEvent }) => {\n  await userEvent.click(button);\n};\nexport default {\n  beforeEach: setup,\n};\n`,
    expect: ['userEvent click userEvent14 inHook'],
  },
  {
    title:
      'an interaction in the cleanup function a beforeEach returns stands in a hook',
    source: `export const Story = {\n  beforeEach: () => () => {\n    button.blur();\n  },\n};\n`,
    expect: ['rawDom inHook'],
  },
  {
    title: 'an interaction in an afterEach given in an array stands in a hook',
    source: `export default {\n  afterEach: [\n    () => {\n      button.blur();\n    },\n  ],\n};\n`,
    expect: ['rawDom inHook'],
  },
  {
    title:
      'an interaction in a beforeEach that a call wraps stands in no hook, as only a hook given inline or as a function declared in the file is one',
    source: `export const Story = {\n  beforeEach: withUser(async ({ userEvent }) => {\n    await userEvent.click(button);\n  }),\n};\n`,
    expect: ['userEvent click unproven'],
  },
];

describe('interactionsOf kinds and origins', () => {
  kindCases.forEach(({ title, source, expect }) => {
    it(title, () => {
      assert.deepEqual(interactionsIn(source), [expect, expect]);
    });
  });
});

/** The first interaction of `source`, once per parse. */
function firstInteractions(
  source: string,
): readonly (Interaction | undefined)[] {
  return programsOf(source).map(
    (program) => interactionsOf(program, csfShapes(program)).all[0],
  );
}

describe('interactionsOf targetValue', () => {
  it('is the init of a const the first argument names, without await', () => {
    firstInteractions(
      inPlay(
        "const input = await canvas.findByRole('textbox');",
        'await userEvent.click(input);',
      ),
    ).forEach((interaction) => {
      assert.equal(
        memberName(field(interaction?.targetValue, 'callee')),
        'findByRole',
      );
    });
  });
});

interface CallCase {
  readonly title: string;
  readonly source: string;
  /** Each interaction's call and arguments, in source order, as source text. */
  readonly expect: readonly CallDescription[];
}

interface CallDescription {
  readonly call: string | undefined;
  readonly args: readonly (string | undefined)[];
}

function textOf(source: string, node: unknown): string | undefined {
  const start = field(node, 'start');
  const end = field(node, 'end');

  return typeof start === 'number' && typeof end === 'number'
    ? source.slice(start, end)
    : undefined;
}

/** The call and arguments of each interaction of `source`, once per parse. */
function callsIn(source: string): readonly (readonly CallDescription[])[] {
  return programsOf(source).map((program) =>
    interactionsOf(program, csfShapes(program)).all.map(({ call, args }) => ({
      call: textOf(source, call),
      args: args.map((argument) => textOf(source, argument)),
    })),
  );
}

const callCases: readonly CallCase[] = [
  {
    title:
      "a user-event interaction's call is its call without await or type wrappers, and its args are that call's arguments",
    source: inPlay(
      "await (userEvent.type(canvas.getByRole('textbox'), 'Ada', { delay: 0 }) as Promise<void>);",
    ),
    expect: [
      {
        call: "userEvent.type(canvas.getByRole('textbox'), 'Ada', { delay: 0 })",
        args: ["canvas.getByRole('textbox')", "'Ada'", '{ delay: 0 }'],
      },
    ],
  },
  {
    title:
      "a fireEvent interaction's call is its call without await, and its args are that call's arguments",
    source: inPlay(
      "await fireEvent(canvas.getByRole('button'), new MouseEvent('click'));",
    ),
    expect: [
      {
        call: "fireEvent(canvas.getByRole('button'), new MouseEvent('click'))",
        args: ["canvas.getByRole('button')", "new MouseEvent('click')"],
      },
    ],
  },
  {
    title:
      "a composed play's call is the play call or the step call that runs it, and its args are that call's arguments",
    source: `export const Other = { play: async () => {} };\nexport const Story = {\n  play: async (context) => {\n    await Other.play(context);\n    await context.step('Again', Other.play);\n  },\n};\n`,
    expect: [
      { call: 'Other.play(context)', args: ['context'] },
      {
        call: "context.step('Again', Other.play)",
        args: ["'Again'", 'Other.play'],
      },
    ],
  },
  {
    title:
      "a raw DOM interaction's call is its call, and its args are that call's arguments",
    source: inPlay(
      "button.dispatchEvent(new Event('input'));",
      'button.blur();',
    ),
    expect: [
      {
        call: "button.dispatchEvent(new Event('input'))",
        args: ["new Event('input')"],
      },
      { call: 'button.blur()', args: [] },
    ],
  },
];

describe('interactionsOf call and args', () => {
  callCases.forEach(({ title, source, expect }) => {
    it(title, () => {
      assert.deepEqual(callsIn(source), [expect, expect]);
    });
  });
});

/** The interactions of `source` and its Program, once per parse. */
function readsOf(
  source: string,
): readonly (readonly [unknown, ReturnType<typeof interactionsOf>])[] {
  return programsOf(source).map(
    (program) =>
      [program, interactionsOf(program, csfShapes(program))] as const,
  );
}

/** The first string literal of `program` whose value is `value`. */
function literalIn(program: unknown, value: string): unknown {
  return descendants(program).find(
    (node) =>
      field(node, 'type') === 'StringLiteral' && field(node, 'value') === value,
  );
}

describe('interactionsOf aimedAt', () => {
  it('gives the interaction whose target query is the call nearest around a node', () => {
    readsOf(
      inPlay(
        "await userEvent.click(canvas.getByRole('button', { name: 'Save' }));",
      ),
    ).forEach(([program, interactions]) => {
      assert.equal(
        interactions.aimedAt(literalIn(program, 'Save')),
        interactions.all[0],
      );
    });
  });

  it('gives none for a node whose nearest call is no interaction target', () => {
    readsOf(inPlay("await userEvent.type(input, 'Ada');")).forEach(
      ([program, interactions]) => {
        assert.equal(
          interactions.aimedAt(literalIn(program, 'Ada')) === undefined,
          true,
        );
      },
    );
  });
});

describe('interactionsOf at', () => {
  it('gives the interaction whose site is a node, by identity', () => {
    readsOf(inPlay('await userEvent.click(button);')).forEach(
      ([program, interactions]) => {
        const statement = descendants(program).find(
          (node) => field(node, 'type') === 'ExpressionStatement',
        );

        assert.equal(
          interactions.at(statement) === interactions.all[0] &&
            interactions.all[0] !== undefined,
          true,
        );
      },
    );
  });
});
