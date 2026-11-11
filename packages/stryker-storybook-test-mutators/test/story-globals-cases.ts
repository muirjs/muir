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
    id: 'story-globals-spread-play',
    title:
      'a story that spreads a story with a play gets mutants of its globals',
    source: storyFile(
      'export const Base = { play: async () => {} };',
      "export const Phone = { ...Base, globals: { viewport: { value: 'phone' } } };",
    ),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-replaced-by-spread',
    title:
      "a story's globals before a spread that sets globals make no mutant, as the spread replaces them",
    source: storyFile(
      "const Base = { globals: { locale: 'de' }, play: async () => {} };",
      "export const Story = { globals: { locale: 'fr' }, ...Base };",
    ),
    expect: [],
  },
  {
    id: 'story-globals-assigned-play',
    title:
      'a story whose play is assigned after it gets mutants of its globals',
    source: storyFile(
      "export const Story = { globals: { viewport: { value: 'phone' } } };",
      'Story.play = async () => {};',
    ),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-not-tested',
    title: 'a story tagged !test makes no mutant, as no test runs it',
    source: storyFile(
      'export const Story = {',
      "  tags: ['!test'],",
      "  globals: { viewport: { value: 'phone' } },",
      '  play: async () => {},',
      '};',
    ),
    expect: [],
  },
  {
    id: 'story-globals-named-test-options',
    title:
      'the globals in .test() options named by a top-level constant get mutants',
    source: factoryFile(
      'export const Story = meta.story({});',
      "const onPhone = { globals: { viewport: { value: 'phone' } } };",
      "Story.test('on a phone', onPhone, async () => {});",
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
    title:
      "a rotated responsive viewport makes no mutant, as the Vitest addon's setViewport reads only its value",
    source: storyFile(
      'export const Story = {',
      "  globals: { viewport: { value: 'responsive', isRotated: true } },",
      '  play: async () => {},',
      '};',
    ),
    expect: [],
  },
  {
    id: 'story-globals-viewport-spread-after-value',
    title:
      'a viewport object with a spread after its responsive value gets a mutant, as the spread may set the value',
    source: storyFile(
      "const phone = { value: 'mobile1' };",
      'export const Story = {',
      "  globals: { viewport: { value: 'responsive', ...phone } },",
      '  play: async () => {},',
      '};',
    ),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-viewport-over-parameters',
    title:
      "a responsive viewport global under the meta's viewport parameters gets a mutant, as setViewport falls back to their defaultViewport",
    source: [
      "export default { title: 'Probe', parameters: { viewport: { defaultViewport: 'mobile1' } } };",
      '',
      "export const Story = { globals: { viewport: { value: 'responsive' } }, play: async () => {} };",
      '',
    ].join('\n'),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-meta-viewport-over-story-parameters',
    title:
      "a responsive viewport global in the meta gets a mutant when a story it runs for sets viewport parameters, which merge over the meta's",
    source: [
      "export default { title: 'Probe', globals: { viewport: { value: 'responsive' } } };",
      '',
      "export const Story = { parameters: { viewport: { defaultViewport: 'mobile1' } }, play: async () => {} };",
      '',
    ].join('\n'),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-test-options-viewport-over-own-parameters',
    title:
      'a responsive viewport global in .test() options gets a mutant when the same options set viewport parameters',
    source: factoryFile(
      'export const Story = meta.story({});',
      "Story.test('t', { parameters: { viewport: { defaultViewport: 'mobile1' } }, globals: { viewport: { value: 'responsive' } } }, async () => {});",
    ),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-story-viewport-under-test-parameters',
    title:
      "a story's responsive viewport global gets a mutant when the options of a .test() call that runs it set viewport parameters",
    source: factoryFile(
      "export const Story = meta.story({ globals: { viewport: { value: 'responsive' } } });",
      "Story.test('t', { parameters: { viewport: { defaultViewport: 'mobile1' } } }, async () => {});",
    ),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-meta-viewport-under-test-parameters',
    title:
      "a meta's responsive viewport global gets a mutant when the options of a .test() call on a story it runs for set viewport parameters",
    source: [
      "import preview from '../.storybook/preview';",
      '',
      "const meta = preview.meta({ title: 'Probe', globals: { viewport: { value: 'responsive' } } });",
      '',
      'export const Story = meta.story({});',
      "Story.test('t', { parameters: { viewport: { defaultViewport: 'mobile1' } } }, async () => {});",
      '',
    ].join('\n'),
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
  {
    id: 'story-globals-default-over-meta',
    title:
      "a story's default value of a global the meta sets gets a mutant, as removing it brings the meta's value back",
    source: [
      "export default { title: 'Probe', globals: { outline: true, viewport: { value: 'mobile1' } } };",
      '',
      'export const Story = {',
      "  globals: { outline: false, viewport: { value: 'responsive' } },",
      '  play: async () => {},',
      '};',
      '',
    ].join('\n'),
    expect: [
      [storyGlobals, '{ outline: false }'],
      [storyGlobals, '{ outline: true }'],
      [storyGlobals, "{ viewport: { value: 'mobile1' } }"],
      [storyGlobals, "{ viewport: { value: 'responsive' } }"],
    ],
  },
  {
    id: 'story-globals-default-over-base',
    title:
      'an .extend() story gets a mutant of a default value of a global its base sets',
    source: factoryFile(
      'export const Base = meta.story({ globals: { outline: true }, play: async () => {} });',
      "export const Plain = Base.extend({ globals: { outline: false, locale: 'de' } });",
    ),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, '{ outline: false }'],
      [storyGlobals, '{}'],
    ],
  },
  {
    id: 'story-globals-default-over-story',
    title:
      'the options of a .test() call get a mutant of a default value of a global the story sets',
    source: factoryFile(
      'export const Story = meta.story({ globals: { outline: true } });',
      "Story.test('plain', { globals: { outline: false, locale: 'de' } }, async () => {});",
    ),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, '{ outline: false }'],
      [storyGlobals, '{}'],
    ],
  },
  {
    id: 'story-globals-default-over-spread',
    title:
      "a default value of a global that a spread story sets makes no mutant, as the story's globals replace the spread's whole",
    source: storyFile(
      'export const Base = { globals: { outline: true }, play: async () => {} };',
      'export const Story = { ...Base, globals: { outline: false } };',
    ),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-shared-test-options',
    title:
      'options shared by .test() calls on two stories keep a default value that one story sets otherwise, whichever story comes first',
    source: factoryFile(
      'export const A = meta.story({ globals: { outline: true } });',
      'export const B = meta.story({});',
      'const opts = { globals: { outline: false } };',
      "A.test('a', opts, async () => {});",
      "B.test('b', opts, async () => {});",
    ),
    expect: [
      [storyGlobals, '{}'],
      [storyGlobals, '{}'],
    ],
  },
  {
    id: 'story-globals-computed-key',
    title:
      'a computed key is no default global, whatever name the identifier in it has',
    source: storyFile(
      "const outline = 'locale';",
      'export const Story = {',
      '  globals: { [outline]: false },',
      '  play: async () => {},',
      '};',
    ),
    expect: [[storyGlobals, '{}']],
  },
];
