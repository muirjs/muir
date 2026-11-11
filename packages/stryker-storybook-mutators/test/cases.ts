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
    id: 'test-name-not-literal',
    title:
      "the args in the options of a .test() call whose name is no string literal make no mutant, as Storybook's index lists no such call",
    source: inFactoryFile(
      'const meta = preview.meta({});',
      'export const Primary = meta.story({});',
      "Primary.test(name, { args: { label: 'a', disabled: true } }, async () => {});",
    ),
    expect: [],
  },
  {
    id: 'test-spread-argument',
    title:
      'a .test() call with a spread argument makes every key of the story stay, as only running the file tells which test function it passes',
    source: inFactoryFile(
      'const meta = preview.meta({});',
      "export const Primary = meta.story({ args: { label: 'a', disabled: true }, play: async () => {} });",
      "Primary.test('t', ...steps);",
    ),
    expect: [],
  },
  {
    id: 'test-name-repeated',
    title:
      'the args in the options of a second .test() call with the same name make no mutant, as Storybook runs the first',
    source: inFactoryFile(
      'const meta = preview.meta({});',
      'export const Primary = meta.story({});',
      "Primary.test('t', async () => {});",
      "Primary.test('t', { args: { label: 'a', disabled: true } }, async () => {});",
    ),
    expect: [],
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
  {
    id: 'shared-test-function',
    title: 'a key read by a test function the .test() call names stays',
    source: inFactoryFile(
      'const meta = preview.meta({});',
      'const sharedTest = async ({ args }) => { args.label; };',
      "export const Primary = meta.story({ args: { label: 'a', disabled: true } });",
      "Primary.test('label', sharedTest);",
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'imported-play-with-test',
    title:
      'a story whose play comes from another module makes no mutant, even with a .test() call',
    source: inFactoryFile(
      "import { sharedPlay } from './shared';",
      'const meta = preview.meta({});',
      "export const Primary = meta.story({ args: { label: 'a', disabled: true }, play: sharedPlay });",
      "Primary.test('t', async () => {});",
    ),
    expect: [],
  },
  {
    id: 'args-default',
    title: 'a key read through args with a default in the pattern stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args = {} }) => { args.label; },',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'args-pattern-default',
    title: 'a key destructured from args with a default in the pattern stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args: { label } = {} }) => { label; },',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'string-key-member-read',
    title: 'a quoted key the play reads as args.<key> stays',
    source: inStory(
      "args: { 'label': 'a', disabled: true },",
      'play: async ({ args }) => { args.label; },',
    ),
    expect: [[args, "{ 'label': 'a' }"]],
  },
  {
    id: 'string-key-destructure',
    title: 'a key the play destructures with quotes stays, and only that key',
    source: inStory(
      "args: { 'aria-label': 'a', title: 'b', disabled: true },",
      "play: async ({ args: { 'aria-label': label } }) => { label; },",
    ),
    expect: [
      [args, "{ 'aria-label': 'a', disabled: true }"],
      [args, "{ 'aria-label': 'a', title: 'b' }"],
      [args, "{ 'aria-label': 'a' }"],
    ],
  },
  {
    id: 'meta-same-literal',
    title:
      "a key whose literal value equals the meta's makes no mutant, nor does removing the other key, which leaves args that behave like ObjectLiteral's {}",
    source:
      "export default { title: 'Button', args: { label: 'a' }, play: async () => {} };\n" +
      "export const Primary = { args: { label: 'a', disabled: true } };\n",
    expect: [],
  },
  {
    id: 'meta-same-negative-number',
    title: "a key whose negative number equals the meta's makes no mutant",
    source:
      "export default { title: 'Button', args: { size: -1 }, play: async () => {} };\n" +
      "export const Primary = { args: { size: -1, label: 'a', disabled: true } };\n",
    expect: [
      [args, "{ size: -1, disabled: true }"],
      [args, "{ size: -1, label: 'a' }"],
    ],
  },
  {
    id: 'meta-same-template-literal',
    title:
      "a key whose template literal without expressions equals the meta's string makes no mutant",
    source:
      "export default { title: 'Button', args: { size: 'small' }, play: async () => {} };\n" +
      "export const Primary = { args: { size: `small`, label: 'a', disabled: true } };\n",
    expect: [
      [args, '{ size: `small`, disabled: true }'],
      [args, "{ size: `small`, label: 'a' }"],
    ],
  },
  {
    id: 'meta-other-literal',
    title: "a key whose literal value differs from the meta's is removed",
    source:
      "export default { title: 'Button', args: { label: 'b', disabled: true }, play: async () => {} };\n" +
      "export const Primary = { args: { label: 'a', disabled: 1 } };\n",
    expect: [
      [args, '{ disabled: 1 }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'meta-same-non-literal',
    title:
      'a key whose value is no literal is removed, even when the meta has the same text',
    source:
      "export default { title: 'Button', args: { onClick: fn(), disabled: true }, play: async () => {} };\n" +
      'export const Primary = { args: { onClick: fn(), disabled: false } };\n',
    expect: [
      [args, '{ disabled: false }'],
      [args, '{ onClick: fn() }'],
    ],
  },
  {
    id: 'meta-exported-by-specifier',
    title:
      "a story in a file whose meta object is exported by specifier makes no mutant, as Storybook's Vitest transform tests no story there",
    source:
      "const meta = { title: 'Button', play: async () => {} };\n" +
      'export { meta as default };\n' +
      "export const Primary = { args: { label: 'a', disabled: true } };\n",
    expect: [],
  },
  {
    id: 'story-tagged-not-test',
    title: 'a story tagged !test makes no mutant',
    source: inStory(
      "tags: ['!test'],",
      "args: { label: 'a', disabled: true },",
      'play: async () => {},',
    ),
    expect: [],
  },
  {
    id: 'meta-tagged-not-test',
    title: 'a story under a meta tagged !test makes no mutant',
    source:
      "export default { title: 'Button', tags: ['!test'], play: async () => {} };\n" +
      "export const Primary = { args: { label: 'a', disabled: true } };\n",
    expect: [],
  },
  {
    id: 'story-tagged-test-under-not-test-meta',
    title:
      "a story tagged test under a meta tagged !test is mutated, as Storybook combines the story's tags after the meta's",
    source:
      "export default { title: 'Button', tags: ['!test'], play: async () => {} };\n" +
      "export const Primary = { tags: ['test'], args: { label: 'a', disabled: true } };\n",
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'shadowed-args',
    title: 'a read of an inner variable that shadows args reads no key',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args }) => {',
      '  const f = (args) => args.label;',
      '},',
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'initial-args-read',
    title: 'a key the play reads as initialArgs.<key> stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ initialArgs }) => { initialArgs.label; },',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'context-key-read',
    title:
      'a key the play reads as context.args.<key> from its context key stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ context }) => { context.args.label; },',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'step-callback-read',
    title: 'a key a step callback reads from the context step passes it stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      "play: async ({ step }) => { await step('s', async ({ args }) => { args.label; }); },",
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'this-parameter',
    title:
      'a key the play reads through the context parameter after a TypeScript this parameter stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async function (this: void, { args }) { args.label; },',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'args-alias',
    title: 'a key the play reads through a variable that holds args stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args }) => { const a = args; a.label; },',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'context-args-alias',
    title:
      'a key the play reads through a variable that holds context.args stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async (context) => { const args = context.args; args.label; },',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'computed-pattern-key',
    title:
      'a play that destructures args with a computed key makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args: { [key]: value } }) => { value; },',
    ),
    expect: [],
  },
  {
    id: 'extend-same-literal',
    title:
      "a key in .extend() whose literal value equals the base story's makes no mutant",
    source: inFactoryFile(
      'const meta = preview.meta({});',
      "export const Primary = meta.story({ args: { label: 'a' }, play: async () => {} });",
      "export const Small = Primary.extend({ args: { label: 'a', size: 's', disabled: true } });",
    ),
    expect: [
      [args, "{ label: 'a', disabled: true }"],
      [args, "{ label: 'a', size: 's' }"],
    ],
  },
  {
    id: 'test-options-same-literal',
    title:
      "a key in .test() options whose literal value equals the story's makes no mutant",
    source: inFactoryFile(
      'const meta = preview.meta({});',
      "export const Primary = meta.story({ args: { label: 'a' } });",
      "Primary.test('t', { args: { label: 'a', size: 's', disabled: true } }, async () => {});",
    ),
    expect: [
      [args, "{ label: 'a', disabled: true }"],
      [args, "{ label: 'a', size: 's' }"],
    ],
  },
  {
    id: 'extend-other-literal-than-base',
    title:
      "a key in .extend() whose literal value equals the meta's but not the base story's is removed",
    source: inFactoryFile(
      'const meta = preview.meta({ args: { disabled: false }, play: async () => {} });',
      'export const Primary = meta.story({ args: { disabled: true } });',
      "export const Enabled = Primary.extend({ args: { label: 'a', disabled: false } });",
    ),
    expect: [
      [args, '{ disabled: false }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'spread-same-literal',
    title:
      'a key whose literal value equals the one in the story args spread before it makes no mutant',
    source:
      "export default { title: 'Button', play: async () => {} };\n" +
      "export const Base = { args: { label: 'a' } };\n" +
      "export const Primary = { args: { ...Base.args, label: 'a', disabled: true } };\n",
    expect: [[args, "{ ...Base.args, label: 'a' }"]],
  },
  {
    id: 'meta-computed-key',
    title:
      'a computed key in the meta args keeps no key of the story from being removed',
    source:
      "export default { title: 'Button', args: { [k]: 'a' }, play: async () => {} };\n" +
      "export const Primary = { args: { k: 'a', disabled: true } };\n",
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ k: 'a' }"],
    ],
  },
];

function inFactoryFile(...statements: readonly string[]): string {
  return `import preview from '../.storybook/preview';\n${statements.join('\n')}\n`;
}

function inStory(...properties: readonly string[]): string {
  return `export default { title: 'Button' };\nexport const Primary = {\n  ${properties.join('\n  ')}\n};\n`;
}
