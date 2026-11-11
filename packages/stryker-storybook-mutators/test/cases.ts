export interface Case {
  readonly id: string;
  readonly title: string;
  /** A story file. */
  readonly source: string;
  /** The mutants this package's mutators make: [mutator name, replacement]. */
  readonly expect: readonly (readonly [string, string])[];
}

const args = 'LzStorybookArgs';

export const cases: readonly Case[] = [
  {
    id: 'csf3-per-key',
    title:
      "each key of a CSF3 story's args that its play does not read is removed",
    source:
      "export default { title: 'Button' };\n" +
      "export const Primary = {\n  args: { label: 'a', disabled: true },\n  play: async () => {},\n};\n",
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'single-key',
    title:
      "removing the only key makes ObjectLiteral's {}, so it makes no mutant",
    source: inStory("args: { label: 'a' },", 'play: async () => {},'),
    expect: [],
  },
  {
    id: 'no-play',
    title: 'a story with no play, under a meta with no play, makes no mutant',
    source: inStory("args: { label: 'a', disabled: true },"),
    expect: [],
  },
  {
    id: 'shared-play',
    title: 'a key read by a play the story names stays',
    source:
      "export default { title: 'Button' };\n" +
      'const sharedPlay = async ({ args, canvas }) => {\n' +
      '  await expect(canvas.getByText(args.label)).toBeVisible();\n' +
      '};\n' +
      "export const Primary = { args: { label: 'a', disabled: true }, play: sharedPlay };\n",
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'imported-play',
    title: 'a story whose play comes from another module makes no mutant',
    source:
      "import { sharedPlay } from './shared';\n" +
      "export default { title: 'Button' };\n" +
      "export const Primary = { args: { label: 'a', disabled: true }, play: sharedPlay };\n",
    expect: [],
  },
  {
    id: 'play-method',
    title: 'a play written as a method reads args like an arrow',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'async play({ args, canvas }) {',
      '  await expect(canvas.getByText(args.label)).toBeVisible();',
      '},',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'args-as-key-name',
    title:
      'an args member or object key that is not the args object reads nothing',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args, canvas }) => {',
      '  await expect(canvas.getByText(other.args)).toBeVisible();',
      "  log({ args: 'none' });",
      '},',
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'meta-args',
    title: "the meta's args make no mutant",
    source:
      "export default { title: 'Button', args: { label: 'a', disabled: true }, play: async () => {} };\n" +
      'export const Primary = {};\n',
    expect: [],
  },
  {
    id: 'not-a-story',
    title: 'args in an object that is no story make no mutant',
    source:
      "export default { title: 'Button' };\n" +
      "const settings = { args: { label: 'a', disabled: true }, play: async () => {} };\n" +
      'export const Primary = { ...settings };\n',
    expect: [],
  },
  {
    id: 'meta-play',
    title: "a story's args are mutated when the meta has a play",
    source:
      "export default { title: 'Button', play: async () => {} };\n" +
      "export const Primary = { args: { label: 'a', disabled: true } };\n",
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'member-read',
    title: 'a key the play reads as args.<key> stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args, canvas }) => {',
      '  await expect(canvas.getByText(args.label)).toBeVisible();',
      '},',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'parameter-destructure',
    title: 'a key the play destructures from args in its parameter stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args: { label }, canvas }) => {',
      '  await expect(canvas.getByText(label)).toBeVisible();',
      '},',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'rest-destructure',
    title: 'a play that collects the rest of args makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args: { label, ...rest }, canvas }) => {',
      '  await expect(canvas.getByText(describe(rest))).toBeVisible();',
      '},',
    ),
    expect: [],
  },
  {
    id: 'context-rest',
    title: 'a play that collects the rest of its context makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ canvas, ...context }) => {',
      '  await expect(canvas.getByText(context.args.label)).toBeVisible();',
      '},',
    ),
    expect: [],
  },
  {
    id: 'body-destructure',
    title: 'a key the play destructures from args in its body stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args, canvas }) => {',
      '  const { label } = args;',
      '  await expect(canvas.getByText(label)).toBeVisible();',
      '},',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'whole-args',
    title: 'a play that passes args whole makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args, canvas }) => {',
      '  await expect(canvas.getByText(describe(args))).toBeVisible();',
      '},',
    ),
    expect: [],
  },
  {
    id: 'context-member-read',
    title: 'a key the play reads as context.args.<key> stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async (context) => {',
      '  await expect(context.canvas.getByText(context.args.label)).toBeVisible();',
      '},',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'whole-context',
    title: 'a play that passes its context whole makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async (context) => {',
      '  await Base.play(context);',
      '},',
    ),
    expect: [],
  },
  {
    id: 'coarse',
    title:
      'the keys the play does not read are also removed together when that differs from {}',
    source: inStory(
      "args: { label: 'a', disabled: true, size: 'small' },",
      'play: async ({ args, canvas }) => {',
      '  await expect(canvas.getByText(args.label)).toBeVisible();',
      '},',
    ),
    expect: [
      [args, "{ label: 'a', size: 'small' }"],
      [args, "{ label: 'a', disabled: true }"],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'spread',
    title: 'a spread in args stays in every mutant',
    source: inStory(
      "args: { ...Base.args, label: 'a', disabled: true },",
      'play: async () => {},',
    ),
    expect: [
      [args, '{ ...Base.args, disabled: true }'],
      [args, "{ ...Base.args, label: 'a' }"],
      [args, '{ ...Base.args }'],
    ],
  },
  {
    id: 'computed-key',
    title: 'a computed key in args stays in every mutant',
    source: inStory(
      "args: { [name]: 'x', label: 'a', disabled: true },",
      'play: async () => {},',
    ),
    expect: [
      [args, "{ [name]: 'x', disabled: true }"],
      [args, "{ [name]: 'x', label: 'a' }"],
      [args, "{ [name]: 'x' }"],
    ],
  },
  {
    id: 'factory-story',
    title: "a factory story's args in .story() are mutated",
    source: inFactoryFile(
      'const meta = preview.meta({});',
      "export const Primary = meta.story({ args: { label: 'a', disabled: true }, play: async () => {} });",
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'factory-meta-play',
    title:
      "a factory story's args are mutated when the factory meta has a play",
    source: inFactoryFile(
      'const meta = preview.meta({ play: async () => {} });',
      "export const Primary = meta.story({ args: { label: 'a', disabled: true } });",
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'extend-base-play',
    title:
      "the args in .extend() are mutated when the base story's play runs for it",
    source: inFactoryFile(
      'const meta = preview.meta({});',
      'export const Primary = meta.story({ play: async () => {} });',
      "export const Disabled = Primary.extend({ args: { label: 'a', disabled: true } });",
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'test-options',
    title: 'the args in the options of a .test() call are mutated',
    source: inFactoryFile(
      'const meta = preview.meta({});',
      'export const Primary = meta.story({});',
      "Primary.test('disabled', { args: { label: 'a', disabled: true } }, async () => {});",
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'story-with-test',
    title:
      "a story's args are mutated when a .test() call runs it, and keys its test function reads stay",
    source: inFactoryFile(
      'const meta = preview.meta({});',
      "export const Primary = meta.story({ args: { label: 'a', disabled: true } });",
      "Primary.test('label', async ({ args, canvas }) => {",
      '  await expect(canvas.getByText(args.label)).toBeVisible();',
      '});',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'play-member-of-other-story',
    title: 'a play that is no function the file declares makes every key stay',
    source:
      "export default { title: 'Button' };\n" +
      'export const A = { play: async ({ args }) => { args.label; } };\n' +
      "export const B = { args: { label: 'a', disabled: true }, play: A.play };\n",
    expect: [],
  },
  {
    id: 'play-call-result',
    title: 'a play made by a call makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: compose(async ({ args }) => { args.label; }),',
    ),
    expect: [],
  },
  {
    id: 'function-declaration-play',
    title: 'a play declared as a function in the file reads args like an arrow',
    source:
      "export default { title: 'Button' };\n" +
      'async function play({ args }) { args.label; }\n' +
      "export const A = { args: { label: 'a', disabled: true }, play };\n",
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'context-default',
    title: 'a context parameter with a default makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async (context = {}) => { context.args.label; },',
    ),
    expect: [],
  },
  {
    id: 'pattern-default',
    title:
      'a destructured context parameter with a default makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args } = {}) => { args.label; },',
    ),
    expect: [],
  },
  {
    id: 'rest-parameter',
    title: 'a rest parameter makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async (...context) => { context[0].args.label; },',
    ),
    expect: [],
  },
  {
    id: 'arguments',
    title: 'a play that reads arguments makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async function () { arguments[0].args.label; },',
    ),
    expect: [],
  },
];

function inFactoryFile(...statements: readonly string[]): string {
  return `import preview from '../.storybook/preview';\n${statements.join('\n')}\n`;
}

function inStory(...properties: readonly string[]): string {
  return `export default { title: 'Button' };\nexport const Primary = {\n  ${properties.join('\n  ')}\n};\n`;
}
