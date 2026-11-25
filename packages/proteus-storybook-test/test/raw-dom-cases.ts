import { type Case, inPlay } from './support/case.ts';

const interaction = 'LzStorybookInteraction';

const rawDomCalls: readonly string[] = [
  'blur()',
  'click()',
  "dispatchEvent(new Event('input'))",
];

export const rawDomCases: readonly Case[] = [
  ...rawDomCalls.map((call) => ({
    id: `raw-dom-${call.slice(0, call.indexOf('('))}`,
    title: `a raw DOM element's ${call} statement is removed`,
    source: inPlay(`button.${call};`),
    expect: [[interaction, ';'] as const],
  })),
  {
    id: 'raw-dom-focus',
    title: "a raw DOM element's focus() statement is removed",
    source: inPlay("canvas.getByRole('textbox').focus();"),
    expect: [[interaction, ';']],
  },
  {
    id: 'raw-dom-arity',
    title:
      'a click with an argument on a receiver that is no user-event makes no mutant',
    source: inPlay("await helper.click(canvas.getByRole('button'));"),
    expect: [],
  },
  {
    id: 'raw-dom-in-story-test',
    title: "a raw DOM element's click() in a story test's body is removed",
    source: `export const Story = meta.story({});\nStory.test('clicks', async () => {\n  button.click();\n});\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'raw-dom-in-named-play',
    title:
      "a raw DOM element's click() in a play function declared in the file and given by name is removed",
    source: `const play = async () => {\n  button.click();\n};\nexport const Story = { play };\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'raw-dom-in-assigned-play',
    title:
      "a raw DOM element's click() in a play function assigned to the story is removed",
    source: `export const Story = {};\nStory.play = async () => {\n  button.click();\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'raw-dom-in-render',
    title: "a raw DOM element's focus() in a story's render makes no mutant",
    source: `export const Story = {\n  render: () => {\n    input.focus();\n    return null;\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'raw-dom-in-decorator',
    title:
      "a raw DOM element's dispatchEvent(event) in a decorator makes no mutant",
    source: `export default {\n  decorators: [\n    (Story) => {\n      window.dispatchEvent(new Event('resize'));\n      return Story();\n    },\n  ],\n};\n`,
    expect: [],
  },
  {
    id: 'raw-dom-in-unexported-story-test',
    title:
      "a raw DOM element's click() in a .test() body of a story the file does not export makes no mutant",
    source: `const Story = meta.story({});\nStory.test('clicks', async () => {\n  button.click();\n});\n`,
    expect: [],
  },
  {
    id: 'raw-dom-in-story-test-of-same-name',
    title:
      "a raw DOM element's click() in a later .test() body with the same name makes no mutant, as Storybook runs only the first",
    source: `export const Story = meta.story({});\nStory.test('clicks', async () => {});\nStory.test('clicks', async () => {\n  button.click();\n});\n`,
    expect: [],
  },
  {
    id: 'raw-dom-in-excluded-export-play',
    title:
      "a raw DOM element's click() in the play of an export that excludeStories leaves out makes no mutant",
    source: `export default { excludeStories: ['helper'] };\nexport const helper = {\n  play: async () => {\n    button.click();\n  },\n};\n`,
    expect: [],
  },
];
