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
