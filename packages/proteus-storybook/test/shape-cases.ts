import { type Case, inStory } from './support/case.ts';

const args = 'LzStorybookArgs';

export const shapeCases: readonly Case[] = [
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
    id: 'duplicate-key',
    title:
      'a key that a later key of the same name overrides makes no mutant, as removing it changes nothing',
    source: inStory(
      "args: { label: 'a', label: 'b', disabled: true },",
      'play: async () => {},',
    ),
    expect: [
      [args, "{ label: 'a', disabled: true }"],
      [args, "{ label: 'a', label: 'b' }"],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'key-before-spread-that-sets-it',
    title:
      'a key that a later spread of a story args the file shows sets makes no mutant, as removing it changes nothing',
    source:
      "export default { title: 'Button', play: async () => {} };\n" +
      "export const Base = { args: { label: 'b' } };\n" +
      "export const Primary = { args: { label: 'a', ...Base.args, disabled: true } };\n",
    expect: [[args, "{ label: 'a', ...Base.args }"]],
  },
  {
    id: 'duplicate-key-later-differs',
    title:
      "a key that overrides an earlier one equal to the meta's is removed, as its own value differs from what it falls back to",
    source:
      "export default { title: 'Button', args: { label: 'a' } };\n" +
      "export const Primary = { args: { label: 'a', label: 'c', size: 1 }, play: async () => {} };\n",
    expect: [
      [args, "{ label: 'a', size: 1 }"],
      [args, "{ label: 'a', label: 'c' }"],
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
    id: 'object-method',
    title: 'a method in args stays in every mutant',
    source: inStory(
      "args: { label: 'a', onClick() {}, disabled: true },",
      'play: async () => {},',
    ),
    expect: [
      [args, '{ onClick() {}, disabled: true }'],
      [args, "{ label: 'a', onClick() {} }"],
      [args, '{ onClick() {} }'],
    ],
  },
  {
    id: 'numeric-key',
    title: 'a numeric key is removed like any other',
    source: inStory(
      "args: { 0: 'a', disabled: true },",
      'play: async () => {},',
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ 0: 'a' }"],
    ],
  },
];
