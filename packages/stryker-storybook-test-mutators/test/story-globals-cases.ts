import type { Case } from './support/case.ts';

const storyGlobals = 'LzStorybookStoryGlobals';

function storyFile(...lines: readonly string[]): string {
  return `export default { title: 'Probe' };\n\n${lines.join('\n')}\n`;
}

function factoryFile(...lines: readonly string[]): string {
  return `import preview from '../.storybook/preview';\n\nconst meta = preview.meta({ title: 'Probe' });\n\n${lines.join('\n')}\n`;
}

export const storyGlobalsCases: readonly Case[] = [
  {
    id: 'story-globals-own',
    title: "a story's only global in a story with a play is removed",
    source: storyFile(
      'export const Story = {',
      "  globals: { viewport: { value: 'mobile1' } },",
      '  play: async () => {},',
      '};',
    ),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-one-per-key',
    title:
      'each global of a story gets its own mutant with that global removed',
    source: storyFile(
      'export const Story = {',
      "  globals: { viewport: { value: 'mobile1' }, locale: 'de' },",
      '  play: async () => {},',
      '};',
    ),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, "{ viewport: { value: 'mobile1' } }"],
    ],
  },
  {
    id: 'story-globals-no-play',
    title: 'a story with no play and no test makes no mutant',
    source: storyFile(
      'export const Story = {',
      "  globals: { viewport: { value: 'mobile1' } },",
      '};',
    ),
    expect: [],
  },
  {
    id: 'story-globals-meta-play',
    title: "a story with the meta's play gets mutants of its globals",
    source: [
      "export default { title: 'Probe', play: async () => {} };",
      '',
      'export const Story = {',
      "  globals: { viewport: { value: 'mobile1' } },",
      '};',
      '',
    ].join('\n'),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-meta',
    title: "the meta's globals in a file with a play get mutants",
    source: [
      "export default { title: 'Probe', globals: { locale: 'de' } };",
      '',
      'export const Story = { play: async () => {} };',
      '',
    ].join('\n'),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-meta-no-play',
    title: "the meta's globals in a file with no play make no mutant",
    source: [
      "export default { title: 'Probe', globals: { locale: 'de' } };",
      '',
      'export const Story = {};',
      '',
    ].join('\n'),
    expect: [],
  },
  {
    id: 'story-globals-factory-test',
    title: 'a factory story with a .test() call and no play gets mutants',
    source: factoryFile(
      "export const Story = meta.story({ globals: { locale: 'de' } });",
      "Story.test('renders', async () => {});",
    ),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-test-options',
    title: 'the globals in the options of a .test() call get mutants',
    source: factoryFile(
      'export const Story = meta.story({});',
      "Story.test('on a phone', { globals: { viewport: { value: 'mobile1' } } }, async () => {});",
    ),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-test-on-other',
    title: 'a .test() call on a name that is no story makes no mutant',
    source: storyFile(
      "suite.test('on a phone', { globals: { locale: 'de' } }, async () => {});",
    ),
    expect: [],
  },
  {
    id: 'story-globals-extend-base-play',
    title:
      'an .extend() story whose base has a play gets mutants of its globals',
    source: factoryFile(
      'export const Base = meta.story({ play: async () => {} });',
      "export const Phone = Base.extend({ globals: { locale: 'de' } });",
    ),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-default-viewport-name',
    title:
      "Storybook's default viewport name makes no mutant, as removing it changes nothing",
    source: storyFile(
      'export const Story = {',
      "  globals: { viewport: 'responsive', locale: 'de' },",
      '  play: async () => {},',
      '};',
    ),
    expect: [[storyGlobals, "{ viewport: 'responsive' }"]],
  },
  {
    id: 'story-globals-default-viewport-object',
    title:
      'a viewport global of the responsive value and no rotation makes no mutant',
    source: storyFile(
      'export const Story = {',
      "  globals: { viewport: { value: '100pct-100pct', isRotated: false }, locale: 'de' },",
      '  play: async () => {},',
      '};',
    ),
    expect: [
      [
        storyGlobals,
        "{ viewport: { value: '100pct-100pct', isRotated: false } }",
      ],
    ],
  },
  {
    id: 'story-globals-default-viewport-undefined',
    title:
      "Storybook's initial viewport global, an undefined value, makes no mutant",
    source: storyFile(
      'export const Story = {',
      "  globals: { viewport: { value: undefined }, locale: 'de' },",
      '  play: async () => {},',
      '};',
    ),
    expect: [[storyGlobals, '{ viewport: { value: undefined } }']],
  },
  {
    id: 'story-globals-rotated-viewport',
    title: 'a rotated responsive viewport is no default, so it gets a mutant',
    source: storyFile(
      'export const Story = {',
      "  globals: { viewport: { value: 'responsive', isRotated: true } },",
      '  play: async () => {},',
      '};',
    ),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-default-backgrounds',
    title:
      "Storybook's initial backgrounds global, no value and no grid, makes no mutant",
    source: storyFile(
      'export const Story = {',
      "  globals: { backgrounds: { value: undefined, grid: false }, locale: 'de' },",
      '  play: async () => {},',
      '};',
    ),
    expect: [
      [storyGlobals, '{ backgrounds: { value: undefined, grid: false } }'],
    ],
  },
  {
    id: 'story-globals-default-measure',
    title: 'measureEnabled: false, its initial global, makes no mutant',
    source: storyFile(
      'export const Story = {',
      "  globals: { measureEnabled: false, locale: 'de' },",
      '  play: async () => {},',
      '};',
    ),
    expect: [[storyGlobals, '{ measureEnabled: false }']],
  },
  {
    id: 'story-globals-default-outline',
    title: 'outline: false, its initial global, makes no mutant',
    source: storyFile(
      'export const Story = {',
      "  globals: { outline: false, locale: 'de' },",
      '  play: async () => {},',
      '};',
    ),
    expect: [[storyGlobals, '{ outline: false }']],
  },
];
