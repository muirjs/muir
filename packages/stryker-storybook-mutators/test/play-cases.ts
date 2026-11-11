import { type Case, inFactoryFile, inStory } from './support/case.ts';

const args = 'LzStorybookArgs';

export const playCases: readonly Case[] = [
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
    id: 'play-before-meta',
    title:
      'a play declared above the meta still lets the keys it does not read be removed',
    source:
      'const sharedPlay = ({ args, canvas }) =>\n' +
      '  expect(canvas.getByText(args.label)).toBeVisible();\n' +
      "export default { title: 'Button' };\n" +
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
    id: 'no-meta',
    title:
      'a story-like object in a file with no CSF meta makes no mutant, as the file is no story file',
    source:
      "export const Primary = { args: { label: 'a', disabled: true }, play: async () => {} };\n",
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
    id: 'second-meta',
    title:
      "a factory meta's play runs for its story, and a key equal to the factory meta's args makes no mutant, in a file that also has a default export",
    source: inFactoryFile(
      "export default { title: 'Button' };",
      "const meta = preview.meta({ args: { label: 'a' }, play: async () => {} });",
      "export const Primary = meta.story({ args: { label: 'a', size: 's', disabled: true } });",
    ),
    expect: [
      [args, "{ label: 'a', disabled: true }"],
      [args, "{ label: 'a', size: 's' }"],
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
    id: 'extend-own-play',
    title:
      "a key read by the play .extend() sets stays, as that play replaces the base story's",
    source: inFactoryFile(
      'const meta = preview.meta({});',
      'export const Primary = meta.story({ play: async () => {} });',
      "export const Disabled = Primary.extend({ args: { label: 'a', disabled: true }, play: async ({ args }) => { args.label; } });",
    ),
    expect: [[args, "{ label: 'a' }"]],
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
    id: 'test-options-named',
    title:
      'the args in .test() options named by a top-level constant are mutated',
    source: inFactoryFile(
      'const meta = preview.meta({});',
      'export const Primary = meta.story({});',
      "const disabledOptions = { args: { label: 'a', disabled: true } };",
      "Primary.test('disabled', disabledOptions, async () => {});",
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'test-options-named-written',
    title:
      'the args in .test() options named by a top-level constant make no mutant when the file writes to that constant, as the args that run may be others',
    source: inFactoryFile(
      'const meta = preview.meta({});',
      'export const Primary = meta.story({});',
      "const disabledOptions = { args: { label: 'a', disabled: true } };",
      "disabledOptions.args = { label: 'b' };",
      "Primary.test('disabled', disabledOptions, async () => {});",
    ),
    expect: [],
  },
  {
    id: 'test-function-reassigned',
    title:
      'the args in .test() options make no mutant when the test function names a binding the file reassigns, as the function that runs may read any key',
    source: inFactoryFile(
      'const meta = preview.meta({});',
      'export const Primary = meta.story({});',
      'let check = async () => {};',
      'check = async ({ args }) => args.whole;',
      "Primary.test('disabled', { args: { label: 'a', disabled: true } }, check);",
    ),
    expect: [],
  },
  {
    id: 'test-options-args-before-unresolved-spread',
    title:
      'the args in .test() options before a spread of an imported object are mutated, as the file does not prove that the spread replaces them',
    source: inFactoryFile(
      "import { shared } from './shared';",
      'const meta = preview.meta({});',
      'export const Primary = meta.story({});',
      "Primary.test('t', { args: { label: 'a', disabled: true }, ...shared }, async () => {});",
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'test-options-args-before-computed-key',
    title:
      'the args in .test() options before a computed key of an imported name are mutated, as the file does not prove that the key replaces them',
    source: inFactoryFile(
      "import { k } from './k';",
      'const meta = preview.meta({});',
      'export const Primary = meta.story({});',
      "Primary.test('t', { args: { label: 'a', disabled: true }, [k]: {} }, async () => {});",
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
    id: 'test-name-not-literal-story-args',
    title:
      "a .test() call whose name is no string literal leaves the story's args mutated, as Storybook does not run it",
    source: inFactoryFile(
      'const meta = preview.meta({});',
      "export const Primary = meta.story({ args: { label: 'a', disabled: true }, play: async () => {} });",
      'Primary.test(name, async () => {});',
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
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
    id: 'test-other-name',
    title:
      'the args in the options of a second .test() call with another name are mutated',
    source: inFactoryFile(
      'const meta = preview.meta({});',
      'export const Primary = meta.story({});',
      "Primary.test('a', async () => {});",
      "Primary.test('b', { args: { label: 'a', disabled: true } }, async () => {});",
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
    id: 'spread-base-play',
    title:
      "a key read by the play of a story spread into the story stays, as that play replaces the meta's",
    source:
      "export default { title: 'Button', play: async () => {} };\n" +
      'export const A = { play: async ({ args }) => { args.label; } };\n' +
      "export const B = { ...A, args: { label: 'a', disabled: true } };\n",
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'replaced-by-spread',
    title:
      "a story's args before a spread that sets args make no mutant, as the spread replaces them",
    source:
      "export default { title: 'Button' };\n" +
      "const Base = { args: { label: 'b' }, play: async () => {} };\n" +
      "export const Primary = { args: { label: 'a', disabled: true }, ...Base };\n",
    expect: [],
  },
  {
    id: 'before-written-spread',
    title:
      "a story's args before a spread of an object the file writes args to are mutated, as the file does not prove that the spread replaces them",
    source:
      "export default { title: 'Button' };\n" +
      'const Base = { parameters: {} };\n' +
      "Base.args = { label: 'b' };\n" +
      "export const Primary = { args: { label: 'a', disabled: true }, ...Base, play: async () => {} };\n",
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'reassigned-play-name',
    title:
      "a story's args make no mutant when its play names a binding the file reassigns, as the play that runs may read any key",
    source:
      "export default { title: 'Button' };\n" +
      'let check = async () => {};\n' +
      'check = async ({ args }) => args.whole;\n' +
      "export const Primary = { args: { label: 'a', disabled: true }, play: check };\n",
    expect: [],
  },
  {
    id: 'play-before-written-spread',
    title:
      "a story's args make no mutant when its play comes before a spread of an object the file writes a play to, as that play may read any key",
    source:
      "export default { title: 'Button' };\n" +
      'const Base = { parameters: {} };\n' +
      'Base.play = async ({ args }) => args.whole;\n' +
      "export const Primary = { play: async () => {}, ...Base, args: { label: 'a', disabled: true } };\n",
    expect: [],
  },
  {
    id: 'before-unresolved-spread',
    title:
      "a story's args before a spread of an imported object are mutated, as the file does not prove that the spread replaces them (ADR 0006)",
    source:
      "import { Shared } from './shared';\n" +
      "export default { title: 'Button' };\n" +
      "export const Primary = { args: { label: 'a', disabled: true }, ...Shared, play: async () => {} };\n",
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'before-computed-key',
    title:
      "a story's args before a computed key of an imported name are mutated, as the file does not prove that the key replaces them",
    source:
      "import { k } from './k';\n" +
      "export default { title: 'Button' };\n" +
      "export const Primary = { args: { label: 'a', disabled: true }, [k]: {}, play: async () => {} };\n",
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'meta-play-from-spread',
    title:
      'the play of a top-level object the meta spreads runs for a story, which keeps the keys it reads',
    source:
      'const common = { play: async ({ args }) => args.label };\n' +
      "export default { title: 'Button', ...common };\n" +
      "export const Primary = { args: { label: 'a', disabled: true } };\n",
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'meta-play-before-unresolved-spread',
    title:
      'a story under a meta play before a spread of an imported object makes no mutant, as the play that runs is unknown and may read any key',
    source:
      "import { shared } from './shared';\n" +
      "export default { title: 'Button', play: async ({ args }) => { args.label; }, ...shared };\n" +
      "export const Primary = { args: { label: 'a', disabled: true } };\n",
    expect: [],
  },
  {
    id: 'computed-key-named-args',
    title:
      'an object under a computed key [args] makes no mutant, as the constant it names gives another key',
    source:
      "const args = 'x';\n" +
      "export default { title: 'Button' };\n" +
      "export const Primary = { [args]: { label: 'a', disabled: true }, play: async () => {} };\n",
    expect: [],
  },
  {
    id: 'assigned-play',
    title:
      'a play assigned to the story after its declaration runs for its args, and a key it reads stays',
    source:
      "export default { title: 'Button' };\n" +
      "export const Primary = { args: { label: 'a', disabled: true } };\n" +
      'Primary.play = async ({ args }) => { args.label; };\n',
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'assigned-play-other-writes',
    title:
      'only a later Primary.play = replaces the play, not a later Primary.play.x = or Primary.storyName =',
    source:
      "export default { title: 'Button' };\n" +
      "export const Primary = { args: { label: 'a', disabled: true } };\n" +
      'Primary.play = async ({ args }) => { args.label; };\n' +
      "Primary.play.displayName = 'p';\n" +
      "Primary.storyName = 'P';\n",
    expect: [[args, "{ label: 'a' }"]],
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
    id: 'other-story-test',
    title: "a key read by another story's test function is removed",
    source: inFactoryFile(
      'const meta = preview.meta({});',
      "export const Primary = meta.story({ args: { label: 'a', disabled: true }, play: async () => {} });",
      'export const Other = meta.story({});',
      "Other.test('t', async ({ args }) => { args.label; });",
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
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
    id: 'story-tagged-not-test-then-other',
    title: 'a story tagged !test then another tag makes no mutant',
    source: inStory(
      "tags: ['!test', 'autodocs'],",
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
    id: 'play-undefined-falls-back-to-meta',
    title:
      "a story whose play is undefined runs the meta's play, as Storybook 10.6.5 prepareStory reads the story's play ?? the meta's",
    source:
      "export default { title: 'Button', play: async ({ args }) => { args.label; } };\n" +
      "export const Primary = { args: { label: 'a', disabled: true }, play: undefined };\n",
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'play-null-falls-back-to-meta',
    title: "a story whose play is null runs the meta's play",
    source:
      "export default { title: 'Button', play: async ({ args }) => { args.label; } };\n" +
      "export const Primary = { args: { label: 'a', disabled: true }, play: null };\n",
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'test-function-second-argument',
    title:
      'a key read by a .test() function given as the second argument stays, as Storybook 10.6.5 runs that one and ignores a third',
    source: inFactoryFile(
      'const meta = preview.meta({});',
      "export const Primary = meta.story({ args: { label: 'a', disabled: true } });",
      "Primary.test('t', async ({ args }) => { args.label; }, async () => {});",
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'test-function-ignored-third-argument',
    title:
      'a key read only by a .test() function after a function second argument is removed, as Storybook 10.6.5 never runs it',
    source: inFactoryFile(
      'const meta = preview.meta({});',
      "export const Primary = meta.story({ args: { label: 'a', disabled: true } });",
      "Primary.test('t', async () => {}, async ({ args }) => { args.label; });",
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'test-function-after-options',
    title:
      'a key read by the .test() function right after the options stays, as Storybook 10.6.5 runs that one and ignores a fourth argument',
    source: inFactoryFile(
      'const meta = preview.meta({});',
      "export const Primary = meta.story({ args: { label: 'a', disabled: true } });",
      "Primary.test('t', {}, async ({ args }) => { args.label; }, async () => {});",
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'test-call-of-spread-only',
    title:
      'a .test(...all) call is no test, as Storybook 10.6.5 CsfFile indexes a .test() call only when its first argument is a string literal',
    source: inFactoryFile(
      "import { all } from './all';",
      'const meta = preview.meta({});',
      "export const Primary = meta.story({ args: { label: 'a', disabled: true }, play: async ({ args }) => { args.label; } });",
      'Primary.test(...all);',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'test-call-of-template-literal-name',
    title:
      'a .test() call named by a template literal is no test, even with a spread argument',
    source: inFactoryFile(
      "import { all } from './all';",
      'const meta = preview.meta({});',
      "export const Primary = meta.story({ args: { label: 'a', disabled: true }, play: async ({ args }) => { args.label; } });",
      'Primary.test(`t`, ...all);',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
];
