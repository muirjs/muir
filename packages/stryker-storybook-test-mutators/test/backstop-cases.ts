import type { Case } from './support/case.ts';

const interaction = 'LzStorybookInteraction';

export const backstopCases: readonly Case[] = [
  {
    id: 'skip-typed-context-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent destructured in a play context typed with a userEvent member, makes no mutant, as a type does not run',
    source: `import type { UserEvent } from 'storybook/test';\nexport const Story = {\n  play: async ({ userEvent }: { userEvent: UserEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-interface-typed-context-click-before-type',
    title:
      'a click directly before a type on the same target, both on the userEvent destructured in a play context typed by an interface with a userEvent member, makes no mutant, as an interface does not run',
    source: `import type { UserEvent } from 'storybook/test';\ninterface PlayContext {\n  userEvent: UserEvent;\n}\nexport const Story = {\n  play: async ({ userEvent }: PlayContext) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'unrelated-user-event-key-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed beside an unrelated object with a userEvent key, as the file names userEvent outside a read",
    source: `export const labels = { userEvent: 'User event' };\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'computed-assigned-hook-written-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach assigned under a computed member writes the context's userEvent type, as the file names userEvent outside a read",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\nStory['beforeEach'] = (context) => {\n  context.userEvent.type = browserUserEvent.type;\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'defined-hook-template-key-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach given by Object.defineProperty sets the context's member under a template key, as the file names userEvent outside a read",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\nObject.defineProperty(Story, 'beforeEach', {\n  value: (context) => {\n    Reflect.set(context, \`userEvent\`, browserUserEvent);\n  },\n});\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'pushed-decorator-written-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a decorator pushed onto Story.decorators writes the context's userEvent type, as the file names userEvent outside a read",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  decorators: [],\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\nStory.decorators.push((S, context) => {\n  context.userEvent.type = browserUserEvent.type;\n  return S();\n});\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'declared-destructured-context-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent, is removed when a beforeEach destructures its context's userEvent in a declaration and only calls it, as the file names userEvent in a destructuring that is not a parameter's",
    source: `export default {\n  beforeEach: async (context) => {\n    const { userEvent } = context;\n    await userEvent.keyboard('{Escape}');\n  },\n};\nexport const Story = {\n  play: async ({ userEvent }) => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
];
