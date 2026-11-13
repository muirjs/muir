import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { csfShapes } from '../src/csf.ts';
import { type Interaction, interactionsOf } from '../src/interactions.ts';
import { field } from '../src/node-field.ts';
import { descendants, memberName } from '../src/node-tree.ts';
import {
  inPlay,
  inPlayWith,
  interactionsIn,
  type KindCase,
} from './support/interactions.ts';
import { programsOf } from './support/parse-module.ts';

const kindCases: readonly KindCase[] = [
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

describe('interactionsOf kinds', () => {
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

/** The method of each interaction of `source`, once per parse. */
function methodsIn(
  source: string,
): readonly (readonly (string | undefined)[])[] {
  return programsOf(source).map((program) =>
    interactionsOf(program, csfShapes(program)).all.map(({ method }) => method),
  );
}

describe('interactionsOf method', () => {
  it("is a raw DOM interaction's DOM method", () => {
    assert.deepEqual(methodsIn(inPlay('input.focus();', 'button.click();')), [
      ['focus', 'click'],
      ['focus', 'click'],
    ]);
  });

  it("is a composed play's play, run or step call method", () => {
    assert.deepEqual(
      methodsIn(
        `export const Other = { play: async () => {} };\nexport const Story = {\n  play: async (context) => {\n    await Other.play(context);\n    await Other.run();\n    await context.step('Again', Other.play);\n    await step('Once more', Other.play);\n  },\n};\n`,
      ),
      [
        ['play', 'run', 'step', 'step'],
        ['play', 'run', 'step', 'step'],
      ],
    );
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
