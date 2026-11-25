import type { Case } from './support/case.ts';

const interaction = 'MuirProteusStorybookTestInteraction';

export const skippedInteractionCases: readonly Case[] = [
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
    id: 'skip-named-before-each',
    title:
      'an interaction in a function declared in the file and given as a beforeEach makes no mutant',
    source: `async function setup({ userEvent }) {\n  await userEvent.click(button);\n}\nexport default {\n  beforeEach: setup,\n};\n`,
    expect: [],
  },
  {
    id: 'skip-named-before-each-under-as',
    title:
      'an interaction in a function declared in the file and given as a beforeEach under as makes no mutant',
    source: `async function setup({ userEvent }) {\n  await userEvent.click(button);\n}\nexport default {\n  beforeEach: setup as Hook,\n};\n`,
    expect: [],
  },
  {
    id: 'skip-named-arrow-before-each',
    title:
      'an interaction in an arrow held in a local and given as a beforeEach makes no mutant',
    source: `const setup = async ({ userEvent }) => {\n  await userEvent.click(button);\n};\nexport default {\n  beforeEach: setup,\n};\n`,
    expect: [],
  },
  {
    id: 'before-each-wrapped',
    title:
      'an interaction in a beforeEach that a call wraps is removed, as only a hook given inline or as a function declared in the file is skipped',
    source: `export const Story = {\n  beforeEach: withUser(async ({ userEvent }) => {\n    await userEvent.click(button);\n  }),\n};\n`,
    expect: [[interaction, ';']],
  },
];
