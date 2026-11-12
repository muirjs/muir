import { type Case, inFactoryFile, inStory } from './support/case.ts';

const args = 'LzStorybookArgs';

export const fallbackCases: readonly Case[] = [
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
    id: 'meta-key-not-last',
    title:
      "a key whose literal value equals the meta's makes no mutant when the meta sets other keys after it",
    source:
      "export default { title: 'Button', args: { label: 'a', size: 's' }, play: async () => {} };\n" +
      "export const Primary = { args: { label: 'a', variant: 'b', disabled: true } };\n",
    expect: [
      [args, "{ label: 'a', disabled: true }"],
      [args, "{ label: 'a', variant: 'b' }"],
    ],
  },
  {
    id: 'meta-same-number-and-boolean',
    title: "a key whose number or boolean equals the meta's makes no mutant",
    source:
      "export default { title: 'Button', args: { size: 1, disabled: true }, play: async () => {} };\n" +
      "export const Primary = { args: { size: 1, disabled: true, label: 'a', variant: 'b' } };\n",
    expect: [
      [args, "{ size: 1, disabled: true, variant: 'b' }"],
      [args, "{ size: 1, disabled: true, label: 'a' }"],
    ],
  },
  {
    id: 'meta-same-negative-number',
    title: "a key whose negative number equals the meta's makes no mutant",
    source:
      "export default { title: 'Button', args: { size: -1 }, play: async () => {} };\n" +
      "export const Primary = { args: { size: -1, label: 'a', disabled: true } };\n",
    expect: [
      [args, '{ size: -1, disabled: true }'],
      [args, "{ size: -1, label: 'a' }"],
    ],
  },
  {
    id: 'meta-other-sign',
    title: "a key whose negative number is the meta's positive one is removed",
    source:
      "export default { title: 'Button', args: { size: 1 }, play: async () => {} };\n" +
      "export const Primary = { args: { size: -1, label: 'a' } };\n",
    expect: [
      [args, "{ label: 'a' }"],
      [args, '{ size: -1 }'],
    ],
  },
  {
    id: 'unary-plus',
    title:
      'a key whose value is a number with a plus sign is removed, as only a minus sign makes a literal',
    source:
      "export default { title: 'Button', args: { size: -1 }, play: async () => {} };\n" +
      "export const Primary = { args: { size: +1, label: 'a' } };\n",
    expect: [
      [args, "{ label: 'a' }"],
      [args, '{ size: +1 }'],
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
    id: 'template-with-expression',
    title:
      "a key whose template literal has an expression is removed, even when its text starts like the meta's",
    source:
      "export default { title: 'Button', args: { label: 'a' }, play: async () => {} };\n" +
      'export const Primary = { args: { label: `a${x}`, disabled: true } };\n',
    expect: [
      [args, '{ disabled: true }'],
      [args, '{ label: `a${x}` }'],
    ],
  },
  {
    id: 'meta-same-null',
    title: 'a key set to null that the meta sets to null makes no mutant',
    source:
      "export default { title: 'Button', args: { label: null }, play: async () => {} };\n" +
      "export const Primary = { args: { label: null, size: 's', disabled: true } };\n",
    expect: [
      [args, '{ label: null, disabled: true }'],
      [args, "{ label: null, size: 's' }"],
    ],
  },
  {
    id: 'undefined-without-meta-value',
    title:
      "a key set to undefined that the meta does not set is removed, as the project's args may set it",
    source: inStory(
      'args: { label: undefined, disabled: true },',
      'play: async () => {},',
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, '{ label: undefined }'],
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
    id: 'test-options-args-before-unresolved-spread-same-literal',
    title:
      "a key in .test() options args before a spread of an imported object is removed, even when its literal value equals the story's, as the spread may set the args the test runs with",
    source: inFactoryFile(
      "import { shared } from './shared';",
      'const meta = preview.meta({});',
      "export const Primary = meta.story({ args: { label: 'a' } });",
      "Primary.test('t', { args: { label: 'a', disabled: true }, ...shared }, async () => {});",
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'test-options-over-unresolved-spread',
    title:
      "a key in .test() options whose literal value equals the meta's is removed when the story's args come before a spread of an imported object, which may set them",
    source: inFactoryFile(
      "import { Shared } from './shared';",
      "const meta = preview.meta({ args: { label: 'a' } });",
      "export const Primary = meta.story({ args: { size: 'm' }, ...Shared, play: async () => {} });",
      "Primary.test('t', { args: { label: 'a', disabled: true } }, async () => {});",
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'over-unread-base-args',
    title:
      "a key of an .extend() story's args whose literal value equals the meta's is removed when the base's args are an imported object, which may set it",
    source: inFactoryFile(
      "import { shared } from './shared';",
      'const meta = preview.meta({ args: { a: 1 } });',
      'export const Base = meta.story({ args: shared });',
      'export const Primary = Base.extend({ args: { a: 1, b: 2 }, play: async () => {} });',
    ),
    expect: [
      [args, '{ a: 1 }'],
      [args, '{ b: 2 }'],
    ],
  },
  {
    id: 'extend-imported-base-over-meta',
    title:
      "a key in .extend() whose literal value equals the meta's is removed when the base story is imported, as the base may set it",
    source: inFactoryFile(
      "import { Base } from './base.stories';",
      "const meta = preview.meta({ args: { label: 'a' } });",
      "export const Primary = Base.extend({ args: { label: 'a', disabled: true }, play: async () => {} });",
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'test-options-over-named-story-args',
    title:
      "a key in .test() options whose literal value equals the one in the top-level object that the story's args name makes no mutant",
    source: inFactoryFile(
      'const shared = { a: 1 };',
      'const meta = preview.meta({});',
      'export const Primary = meta.story({ args: shared });',
      "Primary.test('t', { args: { a: 1, b: 2, c: 3 } }, async () => {});",
    ),
    expect: [
      [args, '{ a: 1, b: 2 }'],
      [args, '{ a: 1, c: 3 }'],
    ],
  },
  {
    id: 'test-options-over-named-story-args-as-const',
    title:
      "a key in .test() options whose literal value equals the one in the top-level object that the story's args name, declared as const, makes no mutant",
    source: inFactoryFile(
      'const shared = { a: 1 } as const;',
      'const meta = preview.meta({});',
      'export const Primary = meta.story({ args: shared });',
      "Primary.test('t', { args: { a: 1, b: 2, c: 3 } }, async () => {});",
    ),
    expect: [
      [args, '{ a: 1, b: 2 }'],
      [args, '{ a: 1, c: 3 }'],
    ],
  },
  {
    id: 'test-options-over-named-story-args-satisfies',
    title:
      "a key in .test() options whose literal value equals the one in the top-level object that the story's args name, declared with satisfies, makes no mutant",
    source: inFactoryFile(
      'const shared = { a: 1 } satisfies Record<string, number>;',
      'const meta = preview.meta({});',
      'export const Primary = meta.story({ args: shared });',
      "Primary.test('t', { args: { a: 1, b: 2, c: 3 } }, async () => {});",
    ),
    expect: [
      [args, '{ a: 1, b: 2 }'],
      [args, '{ a: 1, c: 3 }'],
    ],
  },
  {
    id: 'test-options-over-named-story-args-written',
    title:
      "a key in .test() options whose literal value equals the one in the top-level object that the story's args name is removed when the file writes to that object",
    source: inFactoryFile(
      'const shared = { a: 1 };',
      'shared.a = 2;',
      'const meta = preview.meta({});',
      'export const Primary = meta.story({ args: shared });',
      "Primary.test('t', { args: { a: 1, b: 2, c: 3 } }, async () => {});",
    ),
    expect: [
      [args, '{ a: 1, b: 2 }'],
      [args, '{ a: 1, c: 3 }'],
      [args, '{ b: 2, c: 3 }'],
    ],
  },
  {
    id: 'extend-over-named-base-args-written',
    title:
      "a key in .extend() whose literal value equals the one in the top-level object that the base story's args name is removed when the file writes to that object",
    source: inFactoryFile(
      'const shared = { a: 1 };',
      'shared.a = 2;',
      'const meta = preview.meta({});',
      'export const Base = meta.story({ args: shared });',
      'export const Primary = Base.extend({ args: { a: 1, b: 2, c: 3 }, play: async () => {} });',
    ),
    expect: [
      [args, '{ a: 1, b: 2 }'],
      [args, '{ a: 1, c: 3 }'],
      [args, '{ b: 2, c: 3 }'],
    ],
  },
  {
    id: 'meta-named-args-written',
    title:
      "a key whose literal value equals the one in the top-level object that the meta's args name is removed when the file writes to that object",
    source:
      'const shared = { a: 1 };\n' +
      'shared.a = 2;\n' +
      "export default { title: 'Button', args: shared, play: async () => {} };\n" +
      'export const Primary = { args: { a: 1, b: 2, c: 3 } };\n',
    expect: [
      [args, '{ a: 1, b: 2 }'],
      [args, '{ a: 1, c: 3 }'],
      [args, '{ b: 2, c: 3 }'],
    ],
  },
  {
    id: 'test-options-over-named-story-args-handed-on',
    title:
      "a key in .test() options whose literal value equals the one in the top-level object that the story's args name is removed when the file hands that object to a function",
    source: inFactoryFile(
      "import { mutate } from './mutate';",
      'const shared = { a: 1 };',
      'mutate(shared);',
      'const meta = preview.meta({});',
      'export const Primary = meta.story({ args: shared });',
      "Primary.test('t', { args: { a: 1, b: 2, c: 3 } }, async () => {});",
    ),
    expect: [
      [args, '{ a: 1, b: 2 }'],
      [args, '{ a: 1, c: 3 }'],
      [args, '{ b: 2, c: 3 }'],
    ],
  },
  {
    id: 'test-options-named-same-literal',
    title:
      "a key in .test() options named by a top-level constant whose literal value equals the story's makes no mutant",
    source: inFactoryFile(
      'const meta = preview.meta({});',
      "export const Primary = meta.story({ args: { label: 'a' } });",
      "const sameLabel = { args: { label: 'a', size: 's', disabled: true } };",
      "Primary.test('t', sameLabel, async () => {});",
    ),
    expect: [
      [args, "{ label: 'a', disabled: true }"],
      [args, "{ label: 'a', size: 's' }"],
    ],
  },
  {
    id: 'test-options-shared-same-literal',
    title:
      "a key in .test() options shared by two stories is removed when only one story's value equals it, whichever story comes last",
    source: inFactoryFile(
      'const meta = preview.meta({});',
      'export const B = meta.story({});',
      'export const A = meta.story({ args: { x: 1 } });',
      'const opts = { args: { x: 1, y: 2 } };',
      "B.test('b', opts, () => {});",
      "A.test('a', opts, () => {});",
    ),
    expect: [
      [args, '{ x: 1 }'],
      [args, '{ y: 2 }'],
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
    id: 'spread-of-named-args-same-literal',
    title:
      'a key whose literal value equals the one in the top-level object that the args spread before it name makes no mutant',
    source:
      "const shared = { label: 'a' };\n" +
      'const Base = { args: shared };\n' +
      "export default { title: 'Button', play: async () => {} };\n" +
      "export const Primary = { args: { ...Base.args, label: 'a', disabled: true } };\n",
    expect: [[args, "{ ...Base.args, label: 'a' }"]],
  },
  {
    id: 'spread-of-other-member-same-literal',
    title:
      'a key whose literal value equals the one in a top-level object that a spread of another member than args names makes no mutant',
    source:
      "const defaults = { label: 'a' };\n" +
      'const Common = { defaults };\n' +
      "export default { title: 'Button', play: async () => {} };\n" +
      "export const Primary = { args: { ...Common.defaults, label: 'a', disabled: true } };\n",
    expect: [[args, "{ ...Common.defaults, label: 'a' }"]],
  },
  {
    id: 'spread-of-named-object-same-literal',
    title:
      'a key whose literal value equals the one in a top-level object spread before it makes no mutant',
    source:
      "const shared = { label: 'a' };\n" +
      "export default { title: 'Button', play: async () => {} };\n" +
      "export const Primary = { args: { ...shared, label: 'a', disabled: true } };\n",
    expect: [[args, "{ ...shared, label: 'a' }"]],
  },
  {
    id: 'spread-of-written-args',
    title:
      "a key whose literal value equals the one in the story args spread before it is removed when the file writes to that story's args",
    source:
      "export default { title: 'Button', play: async () => {} };\n" +
      'export const Base = { args: { a: 2 } };\n' +
      'Base.args.a = 1;\n' +
      'export const Primary = { args: { ...Base.args, a: 2, b: 2, c: 3 } };\n',
    expect: [
      [args, '{ ...Base.args, a: 2, b: 2 }'],
      [args, '{ ...Base.args, a: 2, c: 3 }'],
      [args, '{ ...Base.args, b: 2, c: 3 }'],
      [args, '{ ...Base.args }'],
    ],
  },
  {
    id: 'spread-of-args-before-unresolved-spread',
    title:
      "a key whose literal value equals the one in a story's args spread before it is removed when a spread of an imported object comes after that story's args",
    source:
      "import { shared } from './shared';\n" +
      "export default { title: 'Button', play: async () => {} };\n" +
      "export const Base = { args: { label: 'a' }, ...shared };\n" +
      "export const Primary = { args: { ...Base.args, label: 'a', disabled: true } };\n",
    expect: [
      [args, '{ ...Base.args, disabled: true }'],
      [args, "{ ...Base.args, label: 'a' }"],
      [args, '{ ...Base.args }'],
    ],
  },
  {
    id: 'optional-spread-same-literal',
    title:
      "a key whose literal value equals the one in that story's args, spread before it with ?., makes no mutant",
    source:
      "export default { title: 'Button', play: async () => {} };\n" +
      "export const Base = { args: { label: 'a' } };\n" +
      "export const Primary = { args: { ...Base?.args, label: 'a', disabled: true } };\n",
    expect: [[args, "{ ...Base?.args, label: 'a' }"]],
  },
  {
    id: 'string-key-spread-same-literal',
    title:
      "a key whose literal value equals the one in that story's args, spread before it as ['args'], makes no mutant",
    source:
      "export default { title: 'Button', play: async () => {} };\n" +
      "export const Base = { args: { label: 'a' } };\n" +
      "export const Primary = { args: { ...Base['args'], label: 'a', disabled: true } };\n",
    expect: [[args, "{ ...Base['args'], label: 'a' }"]],
  },
  {
    id: 'computed-spread',
    title:
      "a key after a spread with a computed key that only running the file gives is removed, even when its literal value equals that story's args",
    source:
      "export default { title: 'Button', play: async () => {} };\n" +
      "export const Base = { args: { label: 'a' } };\n" +
      "export const Primary = { args: { ...Base[args], label: 'a', disabled: true } };\n",
    expect: [
      [args, '{ ...Base[args], disabled: true }'],
      [args, "{ ...Base[args], label: 'a' }"],
      [args, '{ ...Base[args] }'],
    ],
  },
  {
    id: 'other-member-spread',
    title:
      "a key after a spread of another member than args is removed, even when its literal value equals that story's args",
    source:
      "export default { title: 'Button', play: async () => {} };\n" +
      "export const Base = { args: { label: 'a' } };\n" +
      "export const Primary = { args: { ...Base.parameters, label: 'a', disabled: true } };\n",
    expect: [
      [args, '{ ...Base.parameters, disabled: true }'],
      [args, "{ ...Base.parameters, label: 'a' }"],
      [args, '{ ...Base.parameters }'],
    ],
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
  {
    id: 'meta-spread-same-literal',
    title:
      'a key whose literal value equals the one in the args of a top-level object the meta spreads makes no mutant, nor does removing the other key',
    source:
      "const common = { args: { label: 'a' } };\n" +
      "export default { title: 'Button', ...common, play: async () => {} };\n" +
      "export const Primary = { args: { label: 'a', disabled: true } };\n",
    expect: [],
  },
  {
    id: 'meta-args-before-unresolved-spread',
    title:
      "a key whose literal value equals the meta's is removed when the meta's args come before a spread of an imported object, which may replace them",
    source:
      "import { shared } from './shared';\n" +
      "export default { title: 'Button', args: { label: 'a' }, ...shared };\n" +
      "export const Primary = { args: { label: 'a', disabled: true }, play: async () => {} };\n",
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'computed-key-before',
    title:
      "a key after a computed key is removed, even when its literal value equals the meta's, as the computed key may set it",
    source:
      "export default { title: 'Button', args: { label: 'a' }, play: async () => {} };\n" +
      "export const Primary = { args: { [k]: 'b', label: 'a', disabled: true } };\n",
    expect: [
      [args, "{ [k]: 'b', disabled: true }"],
      [args, "{ [k]: 'b', label: 'a' }"],
      [args, "{ [k]: 'b' }"],
    ],
  },
  {
    id: 'spread-of-object-written-through-story-args',
    title:
      "a key whose literal value equals the one in an object spread before it is removed when the file writes to that object through a story's args it assigns it to",
    source:
      "export default { title: 'Button', play: async () => {} };\n" +
      'const shared = { a: 2 };\n' +
      'export const Base = {};\n' +
      'Base.args = shared;\n' +
      'Base.args.a = 1;\n' +
      'export const Primary = { args: { ...shared, a: 2, b: 2 } };\n',
    expect: [
      [args, '{ ...shared, a: 2 }'],
      [args, '{ ...shared, b: 2 }'],
      [args, '{ ...shared }'],
    ],
  },
  {
    id: 'spread-of-reassigned-let',
    title:
      'a key whose literal value equals the one in an object spread before it is removed when the file reassigns the let that names the object',
    source:
      "export default { title: 'Button', play: async () => {} };\n" +
      'let shared = { a: 2 };\n' +
      'shared = { a: 1 };\n' +
      'export const Primary = { args: { ...shared, a: 2, b: 2 } };\n',
    expect: [
      [args, '{ ...shared, a: 2 }'],
      [args, '{ ...shared, b: 2 }'],
      [args, '{ ...shared }'],
    ],
  },
  {
    id: 'spread-of-object-assigned-to-story-handed-on',
    title:
      "a key whose literal value equals the one in an object spread before it is removed when the file assigns that object to a story's args and hands the story to code it does not read",
    source:
      "export default { title: 'Button', play: async () => {} };\n" +
      'const shared = { a: 2 };\n' +
      'export const Base = {};\n' +
      'Base.args = shared;\n' +
      'mutate(Base);\n' +
      'export const Primary = { args: { ...shared, a: 2, b: 2 } };\n',
    expect: [
      [args, '{ ...shared, a: 2 }'],
      [args, '{ ...shared, b: 2 }'],
      [args, '{ ...shared }'],
    ],
  },
  {
    id: 'test-options-over-written-story',
    title:
      "a key in .test() options whose literal value equals the story's is removed when the file writes to the story's args",
    source: inFactoryFile(
      'const meta = preview.meta({});',
      "export const Primary = meta.story({ args: { label: 'a' }, play: async () => {} });",
      "Primary.input.args.label = 'b';",
      "Primary.test('t', { args: { label: 'a', size: 1 } }, async () => {});",
    ),
    expect: [
      [args, '{ size: 1 }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'written-meta',
    title:
      "a key whose literal value equals the meta's is removed when the file writes to the meta's args",
    source:
      "const meta = { title: 'Button', args: { label: 'a' }, play: async () => {} };\n" +
      'export default meta;\n' +
      "meta.args.label = 'b';\n" +
      "export const Primary = { args: { label: 'a', size: 1 } };\n",
    expect: [
      [args, '{ size: 1 }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'written-story',
    title:
      "a key whose literal value equals the meta's is removed when the file writes to the story's args, as it may read the key when it loads",
    source:
      "export default { title: 'Button', args: { label: 'a' }, play: async () => {} };\n" +
      "export const Primary = { args: { label: 'a', size: 1 } };\n" +
      'Primary.args.text = Primary.args.label;\n',
    expect: [
      [args, '{ size: 1 }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'read-in-other-story',
    title:
      "a key whose literal value equals the meta's is removed when another story reads it when the file loads",
    source:
      "export default { title: 'Button', args: { label: 'a' }, play: async () => {} };\n" +
      "export const Primary = { args: { label: 'a', size: 1 } };\n" +
      'export const Other = { args: { text: Primary.args.label } };\n',
    expect: [
      [args, '{ size: 1 }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'read-in-top-level-constant',
    title:
      "a key whose literal value equals the meta's is removed when a top-level constant reads it when the file loads",
    source:
      "export default { title: 'Button', args: { label: 'a' }, play: async () => {} };\n" +
      "export const Primary = { args: { label: 'a', size: 1 } };\n" +
      'const text = Primary.args.label;\n' +
      'export const Other = { args: { text } };\n',
    expect: [
      [args, '{ size: 1 }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'spread-in-other-story-after-key',
    title:
      "a key whose literal value equals the meta's is removed when another story spreads the args after a key of its own, which the key then falls back to",
    source:
      "export default { title: 'Button', args: { label: 'a' }, play: async () => {} };\n" +
      "export const Primary = { args: { label: 'a', size: 1 } };\n" +
      "export const Other = { args: { label: 'q', ...Primary.args } };\n",
    expect: [
      [args, '{ size: 1 }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'spread-in-extend-of-other-base',
    title:
      "a key whose literal value equals the factory meta's is removed when another story spreads the args over a base that sets the key",
    source: inFactoryFile(
      "const meta = preview.meta({ args: { label: 'a' }, play: async () => {} });",
      "export const Primary = meta.story({ args: { label: 'a', size: 1 } });",
      "const Base = meta.story({ args: { label: 'z' } });",
      'export const Other = Base.extend({ args: { ...Primary.input.args } });',
    ),
    expect: [
      [args, '{ size: 1 }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'test-options-constant-read-in-other-story',
    title:
      "a key in a .test() options constant whose literal value equals the story's is removed when another story reads it when the file loads",
    source:
      "export default { title: 'Button', play: async () => {} };\n" +
      "export const Primary = { args: { label: 'a' } };\n" +
      "const options = { args: { label: 'a', size: 1 } };\n" +
      "Primary.test('t', options, async () => {});\n" +
      'export const Other = { args: { text: options.args.label } };\n',
    expect: [
      [args, '{ size: 1 }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'spread-object-read-in-other-story',
    title:
      "a key whose literal value equals the meta's is removed when the story spreads a top-level object that another story reads when the file loads",
    source:
      "export default { title: 'Button', args: { label: 'a' }, play: async () => {} };\n" +
      "const shared = { args: { label: 'a', size: 1 } };\n" +
      'export const Primary = { ...shared };\n' +
      'export const Other = { args: { text: shared.args.label } };\n',
    expect: [
      [args, '{ size: 1 }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'read-through-spreading-object',
    title:
      "a key whose literal value equals the meta's is removed when another story reads it through a top-level object that spreads the story",
    source:
      "export default { title: 'Button', args: { label: 'a' }, play: async () => {} };\n" +
      "export const Primary = { args: { label: 'a', size: 1 } };\n" +
      'const copy = { ...Primary };\n' +
      'export const Other = { args: { text: copy.args.label } };\n',
    expect: [
      [args, '{ size: 1 }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'story-spread-in-other-story',
    title:
      "a key whose literal value equals the meta's makes no mutant when another story spreads the whole story, as that story runs the same args object",
    source:
      "export default { title: 'Button', args: { label: 'a' }, play: async () => {} };\n" +
      "export const Primary = { args: { label: 'a', size: 1 } };\n" +
      'export const Other = { ...Primary };\n',
    expect: [],
  },
  {
    id: 'test-options-over-written-factory-meta',
    title:
      "a key in .test() options whose literal value equals the factory meta's is removed when the file writes to the meta's args",
    source: inFactoryFile(
      "const meta = preview.meta({ args: { label: 'a' } });",
      "meta.input.args.label = 'b';",
      'export const Primary = meta.story({});',
      "Primary.test('t', { args: { label: 'a', size: 1 } }, async () => {});",
    ),
    expect: [
      [args, '{ size: 1 }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'two-metas-disagree',
    title:
      "a key whose literal value equals one meta's is removed when another meta of the file sets it to another value",
    source: inFactoryFile(
      "export default { title: 'Button', args: { label: 'a' } };",
      "const meta = preview.meta({ args: { label: 'b' }, play: async () => {} });",
      "export const Primary = meta.story({ args: { label: 'a', size: 1 } });",
    ),
    expect: [
      [args, '{ size: 1 }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'two-metas-agree',
    title:
      "a key whose literal value equals every meta's that sets it makes no mutant, though the metas set other keys apart",
    source: inFactoryFile(
      "export default { title: 'Button', args: { label: 'a', size: 2 } };",
      "const meta = preview.meta({ args: { label: 'a' }, play: async () => {} });",
      "export const Primary = meta.story({ args: { label: 'a', size: 1, disabled: true } });",
    ),
    expect: [
      [args, "{ label: 'a', disabled: true }"],
      [args, "{ label: 'a', size: 1 }"],
    ],
  },
  {
    id: 'meta-shares-story-args',
    title:
      'a key of args that the meta and the story both take from one object is removed, as removing it removes the value it would fall back to',
    source:
      "const common = { args: { label: 'a', size: 1 } };\n" +
      "export default { title: 'Button', ...common, play: async () => {} };\n" +
      'export const Primary = { ...common };\n',
    expect: [
      [args, '{ size: 1 }'],
      [args, "{ label: 'a' }"],
    ],
  },
];

export const crashCases: readonly Case[] = [
  {
    id: 'self-spread',
    title:
      'the lookup ends on a story whose args spread its own args, so instrumenting finishes, with no mutant',
    source:
      "export default { title: 'Button', play: async () => {} };\n" +
      "export const Primary = { args: { ...Primary.args, label: 'a', disabled: true } };\n",
    expect: [],
  },
];
