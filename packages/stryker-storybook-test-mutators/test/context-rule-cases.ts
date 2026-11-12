import type { Case } from './support/case.ts';

const interaction = 'LzStorybookInteraction';

export const contextRuleCases: readonly Case[] = [
  {
    id: 'skip-read-hook-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, makes no mutant when the file's decorator and beforeEach only read their contexts' members",
    source: `import { useStoryContext } from 'storybook/preview-api';\nexport default {\n  decorators: [\n    (Story, { args }) => {\n      const { globals } = useStoryContext();\n      return Story({ args, globals });\n    },\n  ],\n  beforeEach: (context) => {\n    context.args.label = 'a';\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-renamed-step-read-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, makes no mutant when a step callback, run through the context's step destructured under another name, only reads its context's members",
    source: `export const Story = {\n  play: async ({ step: runStep, userEvent }) => {\n    await runStep('Read', async ({ args }) => {\n      args.label;\n    });\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-recursive-step-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, makes no mutant when a step callback hands itself to its context's step",
    source: `const fillIn = async (context) => {\n  await context.step('Again', fillIn);\n};\nexport const Story = {\n  play: async ({ step, userEvent }) => {\n    await step('Fill in', fillIn);\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-self-stepping-hook-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, makes no mutant when a beforeEach hands itself to its context's step",
    source: `function prepare(context) {\n  context.step('Again', prepare);\n}\nexport default { beforeEach: prepare };\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-mutually-stepping-hooks-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, makes no mutant when a beforeEach and a function hand each other to their contexts' step",
    source: `function prepare(context) {\n  context.step('Fill', fill);\n}\nfunction fill(context) {\n  context.step('Prepare', prepare);\n}\nexport default { beforeEach: prepare };\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-self-stepping-named-hook-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, makes no mutant when a beforeEach, a named function expression, hands itself by its own name to its context's step",
    source: `export default {\n  beforeEach: function prepare(context) {\n    context.step('Again', prepare);\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'self-stepping-named-writing-hook-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach, a named function expression, hands itself by its own name to its context's step and writes the context's userEvent",
    source: `export default {\n  beforeEach: function prepare(context) {\n    context.step('Again', prepare);\n    context.userEvent = undefined;\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'skip-self-given-context-local-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, makes no mutant when a beforeEach gives a local its context and then the local itself",
    source: `export default {\n  beforeEach: function (context) {\n    var local = context;\n    var local = local;\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-self-given-context-member-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, makes no mutant when the play gives a local its context and then the local's context member",
    source: `export const Story = {\n  play: async (context) => {\n    var local = context;\n    var local = local.context;\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-self-destructured-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, makes no mutant when the play destructures its context's context member into a local and then the local's",
    source: `export const Story = {\n  play: async (context) => {\n    var { context: local } = context;\n    var { context: local } = local;\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-mutually-given-context-locals-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, makes no mutant when a beforeEach gives two locals its context and then each other",
    source: `export default {\n  beforeEach: function (context) {\n    var first = context;\n    var second = first;\n    var first = second;\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-self-given-story-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, makes no mutant when a decorator gives a local useStoryContext() and then the local itself",
    source: `import { useStoryContext } from 'storybook/preview-api';\nexport default {\n  decorators: [\n    (Story) => {\n      var local = useStoryContext();\n      var local = local;\n      return Story();\n    },\n  ],\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-spread-local-meta-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, makes no mutant when the meta spreads a local object whose hooks only read their contexts",
    source: `const sharedMeta = {\n  args: { label: 'Name' },\n  beforeEach: ({ args }) => {\n    args.label;\n  },\n};\nexport default {\n  ...sharedMeta,\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-assigned-local-meta-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, makes no mutant when the meta is Object.assign of a fresh object and a local object whose hooks only read their contexts",
    source: `const sharedMeta = {\n  beforeEach: ({ args }) => {\n    args.label;\n  },\n};\nexport default Object.assign({}, sharedMeta);\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-destructured-hook-name-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, makes no mutant when the file destructures a local named render from an import, as a pattern gives Storybook no hook",
    source: `import { renderers } from './support';\nconst { render } = renderers;\nexport const Story = {\n  play: async ({ userEvent }) => {\n    render;\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'destructured-onto-meta-hook-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a destructuring assignment gives the meta's beforeEach an imported object's, as the story file cannot show the hook it holds",
    source: `import { sharedHooks } from './support';\nconst meta = {};\n({ beforeEach: meta.beforeEach } = sharedHooks);\nexport default meta;\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'skip-parameter-destructured-hook-name-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, makes no mutant when a decorator destructures its context's loaders in its parameter, as a parameter's pattern gives Storybook no hook",
    source: `export default {\n  decorators: [\n    (Story, { loaders }) => {\n      loaders;\n      return Story();\n    },\n  ],\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
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
    id: 'passed-context-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of a play context that the play passes to a function, is removed, as that function may replace the userEvent',
    source: `import { useBrowserUserEvent } from './support';\nexport const Story = {\n  play: async (context) => {\n    useBrowserUserEvent(context);\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'computed-written-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the userEvent of a play context whose ['userEvent'] the play writes, is removed",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async (context) => {\n    context['userEvent'] = browserUserEvent;\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'assigned-into-context-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of a play context that the play gives a userEvent through Object.assign, is removed',
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async (context) => {\n    Object.assign(context, { userEvent: browserUserEvent });\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'defined-on-context-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of a play context that the play defines a userEvent property on, is removed',
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async (context) => {\n    Object.defineProperty(context, 'userEvent', { value: browserUserEvent });\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'key-written-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the userEvent of a play context whose member named by a local holding 'userEvent' the play writes, is removed",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async (context) => {\n    const key = 'userEvent';\n    context[key] = browserUserEvent;\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'local-function-written-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the userEvent of a play context that the play passes to a local function writing its ['userEvent'], is removed",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async (context) => {\n    const useBrowser = (target) => {\n      target['userEvent'] = browserUserEvent;\n    };\n    useBrowser(context);\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'hook-assigned-user-event-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach gives the context a userEvent through Object.assign",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport default {\n  beforeEach: (context) => {\n    Object.assign(context, { userEvent: browserUserEvent });\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'written-context-user-event-method-click-before-type',
    title:
      "a click directly before a type on the same target, both on the userEvent of a play context whose userEvent's type the play writes, is removed",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async (context) => {\n    context.userEvent.type = browserUserEvent.type;\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'destructuring-written-context-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of a play context whose userEvent a destructuring assignment in the play writes, is removed',
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async (context) => {\n    ({ userEvent: context.userEvent } = { userEvent: browserUserEvent });\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'hook-set-user-event-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach sets the context's 'userEvent' through Reflect.set",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport default {\n  beforeEach: (context) => {\n    Reflect.set(context, 'userEvent', browserUserEvent);\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'hook-passed-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach passes its context to a function, as that function may replace the userEvent",
    source: `import { slowDown } from './support';\nexport default {\n  beforeEach: (context) => {\n    slowDown(context);\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'hook-template-key-written-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach writes the context's member under a template key",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport default {\n  beforeEach: (context) => {\n    context[\`userEvent\`] = browserUserEvent;\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'hook-built-key-written-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach writes the context's member under a key it builds",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport default {\n  beforeEach: (context) => {\n    context['user' + 'Event'] = browserUserEvent;\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'hook-destructured-written-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach destructures that userEvent and writes its type",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport default {\n  beforeEach: ({ userEvent: user }) => {\n    user.type = browserUserEvent.type;\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'hook-rest-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach gathers its context's members in a rest element",
    source: `import { slowDown } from './support';\nexport default {\n  beforeEach: ({ ...rest }) => {\n    slowDown(rest);\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'decorator-passed-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a decorator passes its context to a function, as Storybook renders it on the same context before the play",
    source: `import { slowDown } from './support';\nexport default {\n  decorators: [\n    (Story, context) => {\n      slowDown(context);\n      return Story();\n    },\n  ],\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'passed-context-member-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of a play context whose context member the play passes to a function, is removed, as Storybook sets that member to the context itself',
    source: `import { slowDown } from './support';\nexport const Story = {\n  play: async (context) => {\n    slowDown(context.context);\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'written-context-member-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent of a play context, is removed when the play writes the userEvent of its context member under a template key',
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async (context) => {\n    context.context[\`userEvent\`] = browserUserEvent;\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'passed-destructured-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when the play destructures the context's context member and passes it to a function",
    source: `import { slowDown } from './support';\nexport const Story = {\n  play: async ({ context, userEvent }) => {\n    slowDown(context);\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'hook-method-passed-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach method passes its context to a function",
    source: `import { slowDown } from './support';\nexport default {\n  beforeEach(context) {\n    slowDown(context);\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'loader-passed-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a loader passes its context to a function, as Storybook runs it on the same context before the play",
    source: `import { slowDown } from './support';\nexport const Story = {\n  loaders: [\n    async (context) => {\n      slowDown(context);\n    },\n  ],\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'render-written-user-event-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when the render function writes that userEvent's type, as Storybook renders before the play",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  render: (args, { userEvent: user }) => {\n    user.type = browserUserEvent.type;\n    return args.label;\n  },\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'named-hook-passed-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach given by the name of a local function passes its context to a function",
    source: `import { slowDown } from './support';\nconst slowDownContext = (context) => {\n  slowDown(context);\n};\nexport default {\n  beforeEach: slowDownContext,\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'imported-decorator-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a decorator is imported, as the story file cannot show what it does with the context",
    source: `import { withSlowUser } from './support';\nexport default {\n  decorators: [withSlowUser],\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'assigned-hook-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach assigned as Story.beforeEach passes its context to a function",
    source: `import { slowDown } from './support';\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\nStory.beforeEach = (context) => {\n  slowDown(context);\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'step-passed-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when an earlier step callback passes its context to a function, as Storybook runs it with the play's context",
    source: `import { slowDown } from './support';\nexport const Story = {\n  play: async ({ step, userEvent }) => {\n    await step('Slow down', async (context) => {\n      slowDown(context);\n    });\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'story-context-hook-passed-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a decorator passes useStoryContext()'s context to a function",
    source: `import { useStoryContext } from 'storybook/preview-api';\nimport { slowDown } from './support';\nexport default {\n  decorators: [\n    (Story) => {\n      slowDown(useStoryContext());\n      return Story();\n    },\n  ],\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'computed-hook-key-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a function under a computed key that a local holds passes its context to a function, as that key may name a hook",
    source: `import { slowDown } from './support';\nconst hook = 'beforeEach';\nexport default {\n  [hook]: (context) => {\n    slowDown(context);\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'hook-arguments-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach function with no parameter passes its arguments to a function",
    source: `import { slowDown } from './support';\nexport default {\n  beforeEach: function () {\n    slowDown(arguments[0]);\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'decorator-rest-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a decorator gathers its arguments in a rest parameter and passes them to a function",
    source: `import { slowDown } from './support';\nexport default {\n  decorators: [\n    (...decoratorArguments) => {\n      slowDown(decoratorArguments);\n      return decoratorArguments[0]();\n    },\n  ],\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'reassigned-hook-declaration-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach names a local function declaration the file reassigns to one that passes its context to a function",
    source: `import { slowDown } from './support';\nfunction slowDownContext(context) {}\nslowDownContext = (context) => {\n  slowDown(context);\n};\nexport default {\n  beforeEach: slowDownContext,\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'getter-hook-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach getter returns a function that passes its context to a function",
    source: `import { slowDown } from './support';\nexport default {\n  get beforeEach() {\n    return (context) => {\n      slowDown(context);\n    };\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'hook-parameter-and-arguments-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach that names its context passes its arguments to a function",
    source: `import { slowDown } from './support';\nexport default {\n  beforeEach: function (context) {\n    context.args;\n    slowDown(arguments[0]);\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'computed-assigned-hook-passed-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a function assigned under a computed member passes its context to a function, as that member may name a hook",
    source: `import { slowDown } from './support';\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\nStory['beforeEach'] = (context) => {\n  slowDown(context);\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'computed-hook-key-array-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when an array under a computed key that a local holds has a function that passes its context to a function, as that key may name decorators",
    source: `import { slowDown } from './support';\nconst hooks = 'decorators';\nexport default {\n  [hooks]: [\n    (Story, context) => {\n      slowDown(context);\n      return Story();\n    },\n  ],\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'computed-hook-key-named-function-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a computed key that a local holds names a local function that passes its context to a function",
    source: `import { slowDown } from './support';\nconst hook = 'beforeEach';\nconst slowDownContext = (context) => {\n  slowDown(context);\n};\nexport default {\n  [hook]: slowDownContext,\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'renamed-story-context-hook-passed-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a decorator passes the context of useStoryContext, imported under another name, to a function",
    source: `import { useStoryContext as storyContext } from 'storybook/preview-api';\nimport { slowDown } from './support';\nexport default {\n  decorators: [\n    (Story) => {\n      slowDown(storyContext());\n      return Story();\n    },\n  ],\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'renamed-step-passed-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a step callback, run through the context's step destructured under another name, passes its context to a function",
    source: `import { slowDown } from './support';\nexport const Story = {\n  play: async ({ step: runStep, userEvent }) => {\n    await runStep('Slow down', async (context) => {\n      slowDown(context);\n    });\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'step-member-local-passed-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a step callback, run through a local the context's step member is given to, passes its context to a function",
    source: `import { slowDown } from './support';\nexport const Story = {\n  play: async (context) => {\n    const runStep = context.step;\n    await runStep('Slow down', async (stepContext) => {\n      slowDown(stepContext);\n    });\n    await context.userEvent.click(input);\n    await context.userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'spread-imported-meta-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when the meta spreads an imported object, as the story file cannot show the hooks it holds",
    source: `import { sharedMeta } from './support';\nexport default {\n  ...sharedMeta,\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'spread-imported-story-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when the story spreads a story of another file, as the story file cannot show the hooks it holds",
    source: `import * as Base from './Base.stories';\nexport const Story = {\n  ...Base.Primary,\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'assigned-imported-hooks-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when Object.assign copies an imported object onto the meta, as the story file cannot show the hooks it holds",
    source: `import { sharedHooks } from './support';\nconst meta = {};\nObject.assign(meta, sharedHooks);\nexport default meta;\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'assigned-imported-hooks-onto-fresh-meta-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when the meta is Object.assign of a fresh object and an imported one, as the story file cannot show the hooks it holds",
    source: `import { sharedHooks } from './support';\nexport default Object.assign({}, sharedHooks);\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'spread-step-arguments-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when the play spreads its arguments into the context's step, as the story file cannot show the callback it runs",
    source: `import { slowDown } from './support';\nexport const Story = {\n  play: async ({ step, userEvent }) => {\n    const stepArguments = ['Slow down', slowDown];\n    await step(...stepArguments);\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
];
