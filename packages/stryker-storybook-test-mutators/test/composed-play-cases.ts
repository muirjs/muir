import { type Case, inPlay, inPlayWith } from './support/case.ts';

const interaction = 'LzStorybookInteraction';

export const composedPlayCases: readonly Case[] = [
  {
    id: 'composed-play',
    title:
      "a composed play, another story's play called with the context, is removed",
    source: `export const Other = { play: async () => {} };\nexport const Story = {\n  play: async (context) => {\n    await Other.play(context);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'composed-play-namespace',
    title:
      'a composed play of a story from a namespace import, Stories.Other.play(context), is removed',
    source: `import * as Stories from './Other.stories';\nexport const Story = {\n  play: async (context) => {\n    await Stories.Other.play(context);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'composed-run',
    title: "a CSF factory story's run() is removed",
    source: `export const Other = meta.story({});\nexport const Story = meta.story({\n  play: async () => {\n    await Other.run();\n  },\n});\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'composed-optional-play',
    title: "an optional call of the meta's play is removed",
    source: `const meta = {};\nexport default meta;\nexport const Story = {\n  play: async (context) => {\n    await meta.play?.(context);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'composed-play-non-null',
    title:
      'a composed play called through a non-null assertion, Other.play!(context), is removed',
    source: `export const Other = { play: async () => {} };\nexport const Story = {\n  play: async (context) => {\n    await Other.play!(context);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'composed-play-in-assigned-play',
    title:
      'a composed play in a play function assigned to the story is removed',
    source: `export const Other = { play: async () => {} };\nexport const Story = {};\nStory.play = async (context) => {\n  await Other.play(context);\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'composed-step',
    title: "a step that runs another story's play is removed",
    source: `export const Other = { play: async () => {} };\nexport const Story = {\n  play: async ({ step }) => {\n    await step('Enter value', Other.play);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'composed-step-namespace',
    title:
      'a step that runs the play of a story from a namespace import, step(label, Stories.Other.play), is removed',
    source: `import * as Stories from './Other.stories';\nexport const Story = {\n  play: async ({ step }) => {\n    await step('Enter value', Stories.Other.play);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'composed-step-non-null',
    title:
      "a step that runs another story's play through a non-null assertion is removed",
    source: `export const Other = { play: async () => {} };\nexport const Story = {\n  play: async ({ step }) => {\n    await step('Enter value', Other.play!);\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'call-given-story-play',
    title: "a call other than step given another story's play makes no mutant",
    source: `export const Other = { play: async () => {} };\nexport const Story = {\n  play: async () => {\n    await runPlay('Enter value', Other.play);\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'step-given-other-member',
    title: 'a step given a function other than a play makes no mutant',
    source: inPlayWith(['step'], "await step('Open menu', helpers.openMenu);"),
    expect: [],
  },
  {
    id: 'play-call-on-query',
    title:
      'a play() call on a receiver that is no identifier or member chain starting at one, such as a queried video, makes no mutant',
    source: inPlay("await canvas.getByTestId('video').play();"),
    expect: [],
  },
  {
    id: 'step-given-other-member-play',
    title:
      'a step given the play of a receiver that is no identifier or member chain starting at one makes no mutant',
    source: inPlayWith(
      ['canvas', 'step'],
      "await step('Start', canvas.getByTestId('video').play);",
    ),
    expect: [],
  },
  {
    id: 'play-call-in-render',
    title: "a video's play() in a story's render makes no mutant",
    source: `export const Story = {\n  render: () => {\n    useEffect(() => {\n      video.play();\n    });\n    return null;\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'play-call-in-render-object-play',
    title:
      "a video's play() in a play property of an object a render builds makes no mutant",
    source: `export const Story = {\n  render: () => {\n    const player = {\n      play: () => {\n        video.play();\n      },\n    };\n    return player;\n  },\n};\n`,
    expect: [],
  },
];
