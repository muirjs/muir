import { type Case, inPlay } from './support/case.ts';

const interaction = 'LzStorybookInteraction';

export const bindingRuleCases: readonly Case[] = [
  {
    id: 'skip-cast-import-click-before-type',
    title:
      "a click directly before a type on the same target, both on userEvent imported from 'storybook/test' under a type assertion, makes no mutant, as the assertion does not change the receiver",
    source: `import { type UserEvent, userEvent } from 'storybook/test';\nexport const Story = {\n  play: async () => {\n    await (userEvent as UserEvent).click(input);\n    await (userEvent as UserEvent).type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-non-null-setup-click-before-type',
    title:
      "a click directly before a type on the same target, both on the setup() of userEvent imported from 'storybook/test' under a non-null assertion, makes no mutant",
    source: `import { userEvent } from 'storybook/test';\nexport const Story = {\n  play: async () => {\n    const user = userEvent.setup();\n    await user!.click(input);\n    await user!.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'skip-type-query-import-click-before-type',
    title:
      "a click directly before a type on the same target, both on userEvent imported from 'storybook/test', makes no mutant when a type reads that import with typeof, as a type does not run",
    source: `import { userEvent } from 'storybook/test';\nexport const Story = {\n  play: async () => {\n    type User = typeof userEvent;\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'written-renamed-context-user-event-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent destructured under another name, is removed when the play writes that local's type",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nexport const Story = {\n  play: async ({ userEvent: user }) => {\n    user.type = browserUserEvent.type;\n    await user.click(input);\n    await user.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'passed-renamed-context-user-event-click-before-type',
    title:
      "a click directly before a type on the same target, both on the play context's userEvent destructured under another name, is removed when the play passes that local to a function, as that function may change it",
    source: `import { slowDown } from './support';\nexport const Story = {\n  play: async ({ userEvent: user }) => {\n    slowDown(user);\n    await user.click(input);\n    await user.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'written-renamed-import-click-before-type',
    title:
      "a click directly before a type on the same target, both on userEvent imported under another name from 'storybook/test', is removed when the file writes that import's type",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nimport { userEvent as ue } from 'storybook/test';\nexport const Story = {\n  play: async () => {\n    ue.type = browserUserEvent.type;\n    await ue.click(input);\n    await ue.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'aliased-import-click-before-type',
    title:
      "a click directly before a type on the same target, both on userEvent imported under another name from 'storybook/test', is removed when the file gives that import to another local and writes its type",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nimport { userEvent as ue } from 'storybook/test';\nexport const Story = {\n  play: async () => {\n    const slowUser = ue;\n    slowUser.type = browserUserEvent.type;\n    await ue.click(input);\n    await ue.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'written-default-import-click-before-type',
    title:
      "a click directly before a type on the same target, both on the default import of '@testing-library/user-event' under another name, is removed when the file writes that import's type",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nimport ue from '@testing-library/user-event';\nexport const Story = {\n  play: async () => {\n    ue.type = browserUserEvent.type;\n    await ue.click(input);\n    await ue.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'written-import-click-before-type',
    title:
      "a click directly before a type on the same target, both on userEvent imported from 'storybook/test', is removed when the file writes that import's type",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nimport { userEvent } from 'storybook/test';\nexport const Story = {\n  play: async () => {\n    userEvent.type = browserUserEvent.type;\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'written-setup-click-before-type',
    title:
      "a click directly before a type on the same target, both on the setup() of userEvent imported from 'storybook/test', is removed when the play writes that local's type",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nimport { userEvent } from 'storybook/test';\nexport const Story = {\n  play: async () => {\n    const user = userEvent.setup();\n    user.type = browserUserEvent.type;\n    await user.click(input);\n    await user.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'written-choice-click-before-type',
    title:
      "a click directly before a type on the same target, both on a local that is one of two user-event 14 instances, is removed when the play writes that local's type",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\n${inPlay(
      'const slowUser = userEvent.setup({ delay: 100 });',
      'const user = slow ? slowUser : userEvent;',
      'user.type = browserUserEvent.type;',
      'await user.click(input);',
      "await user.type(input, 'a');",
    )}`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'namespace-written-import-click-before-type',
    title:
      "a click directly before a type on the same target, both on userEvent imported from 'storybook/test', is removed when the file writes the type of that module's userEvent through a namespace import",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nimport { userEvent } from 'storybook/test';\nimport * as test from 'storybook/test';\nexport const Story = {\n  play: async () => {\n    test.userEvent.type = browserUserEvent.type;\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'dynamic-import-written-click-before-type',
    title:
      "a click directly before a type on the same target, both on userEvent imported from 'storybook/test', is removed when the file also imports that module with import() and writes its userEvent's type",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nimport { userEvent } from 'storybook/test';\nexport const Story = {\n  play: async () => {\n    const { userEvent: slowUser } = await import('storybook/test');\n    slowUser.type = browserUserEvent.type;\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'required-written-click-before-type',
    title:
      "a click directly before a type on the same target, both on userEvent imported from 'storybook/test', is removed when the file also loads that module with require() and writes its userEvent's type",
    source: `import { userEvent as browserUserEvent } from 'vitest/browser';\nimport { userEvent } from 'storybook/test';\nconst test = require('storybook/test');\ntest.userEvent.type = browserUserEvent.type;\nexport const Story = {\n  play: async () => {\n    await userEvent.click(input);\n    await userEvent.type(input, 'a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
];
