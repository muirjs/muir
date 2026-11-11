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
    id: 'story-globals-own-before-unresolved-spread',
    title:
      "a story's globals before a spread of an imported object are a site, as the file does not prove that the spread replaces them",
    source: [
      "import { Shared } from './shared';",
      '',
      "export default { title: 'Probe' };",
      '',
      "export const Story = { globals: { locale: 'fr' }, ...Shared, play: async () => {} };",
      '',
    ].join('\n'),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-unknown-play',
    title:
      "a story whose play only a spread of an imported object may set makes no mutant, its own globals nor the meta's, as that spread may set no play",
    source: [
      "import { Shared } from './shared';",
      '',
      "export default { title: 'Probe', globals: { locale: 'de' } };",
      '',
      "export const Story = { ...Shared, globals: { locale: 'fr' } };",
      '',
    ].join('\n'),
    expect: [],
  },
  {
    id: 'story-globals-unknown-play-over-meta-play',
    title:
      "a story whose play a spread of an imported object may set over the meta's play gets its own and the meta's globals mutants, as a play runs whatever that spread sets",
    source: [
      "import { Shared } from './shared';",
      '',
      "export default { title: 'Probe', globals: { locale: 'de' }, play: async () => {} };",
      '',
      "export const Story = { ...Shared, globals: { locale: 'fr' } };",
      '',
    ].join('\n'),
    expect: [
      [storyGlobals, '{}'],
      [storyGlobals, '{}'],
    ],
  },
  {
    id: 'story-globals-unknown-play-over-base-play',
    title:
      "an .extend() story whose play a spread of an imported object may set over its base's play gets its globals mutant",
    source: factoryFile(
      "import { Shared } from './shared';",
      'export const Base = meta.story({ play: async () => {} });',
      "export const Story = Base.extend({ ...Shared, globals: { locale: 'fr' } });",
    ),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-unknown-play-over-own-play',
    title:
      'a story whose own play comes before a spread of an imported object gets its globals mutant, as a play runs whatever that spread sets',
    source: [
      "import { Shared } from './shared';",
      '',
      "export default { title: 'Probe' };",
      '',
      "export const Story = { play: async () => {}, ...Shared, globals: { locale: 'fr' } };",
      '',
    ].join('\n'),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-test-options-over-unresolved-spread',
    title:
      "the options of a .test() call get a mutant of a default value when the story's globals come before a spread of an imported object, which may set that global, and the story's globals get theirs",
    source: [
      "import { Shared } from './shared';",
      "import preview from '../.storybook/preview';",
      '',
      "const meta = preview.meta({ title: 'Probe' });",
      '',
      "export const Story = meta.story({ globals: { locale: 'fr' }, ...Shared });",
      "Story.test('t', { globals: { outline: false } }, async () => {});",
      '',
    ].join('\n'),
    expect: [
      [storyGlobals, '{}'],
      [storyGlobals, '{}'],
    ],
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
    id: 'story-globals-named-test-options-written',
    title:
      'the globals in .test() options named by a top-level constant get no mutant when the file writes to that constant, as the globals that run may be others',
    source: factoryFile(
      'export const Story = meta.story({});',
      "const onPhone = { globals: { viewport: { value: 'phone' } } };",
      "onPhone.globals = { locale: 'de' };",
      "Story.test('on a phone', onPhone, async () => {});",
    ),
    expect: [],
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
    id: 'story-globals-story-viewport-under-imported-test-options',
    title:
      "a story's responsive viewport global gets a mutant when a .test() call that runs it takes imported options, which may set viewport parameters",
    source: factoryFile(
      "import { opts } from './shared';",
      "export const Story = meta.story({ globals: { viewport: { value: 'responsive' } } });",
      "Story.test('t', opts, async () => {});",
    ),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-story-viewport-under-spread-test-options',
    title:
      "a story's responsive viewport global gets a mutant when the options of a .test() call that runs it spread an imported object, which may set viewport parameters",
    source: factoryFile(
      "import { opts } from './shared';",
      "export const Story = meta.story({ globals: { viewport: { value: 'responsive' } } });",
      "Story.test('t', { ...opts }, async () => {});",
    ),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-story-viewport-under-unmatched-test',
    title:
      "a story's responsive viewport global gets a mutant when an unmatched .test('t', ...testArgs) call runs it, as its options may set viewport parameters",
    source: factoryFile(
      "import { testArgs } from './shared';",
      "export const Story = meta.story({ globals: { viewport: { value: 'responsive' } } });",
      "Story.test('t', ...testArgs);",
    ),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-test-options-viewport-over-own-spread',
    title:
      'a responsive viewport global in .test() options gets a mutant when those options also spread an imported object, which may set viewport parameters',
    source: factoryFile(
      "import { opts } from './shared';",
      'export const Story = meta.story({});',
      "Story.test('t', { ...opts, globals: { viewport: { value: 'responsive' } } }, async () => {});",
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
    id: 'story-globals-default-string-key',
    title:
      "a default global written with a string-literal key, 'outline': false, makes no mutant",
    source: storyFile(
      'export const Story = {',
      "  globals: { 'outline': false, locale: 'de' },",
      '  play: async () => {},',
      '};',
    ),
    expect: [[storyGlobals, "{ 'outline': false }"]],
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
    id: 'story-globals-default-under-meta-spread',
    title:
      "a story's default value of a global gets no mutant when the globals of a top-level object the meta spreads do not set it, and those globals are the meta's site",
    source: [
      "const common = { globals: { locale: 'de' } };",
      "export default { title: 'Probe', ...common };",
      '',
      'export const Story = {',
      "  globals: { outline: false, locale: 'fr' },",
      '  play: async () => {},',
      '};',
      '',
    ].join('\n'),
    expect: [
      [storyGlobals, '{ outline: false }'],
      [storyGlobals, '{}'],
    ],
  },
  {
    id: 'story-globals-default-under-named-meta-globals',
    title:
      "a story's default value of a global gets no mutant when the meta's globals name a top-level object that does not set it",
    source: [
      "const metaGlobals = { locale: 'de' };",
      "export default { title: 'Probe', globals: metaGlobals };",
      '',
      'export const Story = {',
      "  globals: { outline: false, locale: 'fr' },",
      '  play: async () => {},',
      '};',
      '',
    ].join('\n'),
    expect: [[storyGlobals, '{ outline: false }']],
  },
  {
    id: 'story-globals-viewport-under-named-meta-parameters',
    title:
      "a story's default viewport gets no mutant when the meta's parameters name a top-level object that does not set viewport",
    source: [
      "const metaParameters = { layout: 'centered' };",
      "export default { title: 'Probe', parameters: metaParameters };",
      '',
      'export const Story = {',
      "  globals: { viewport: 'responsive', locale: 'fr' },",
      '  play: async () => {},',
      '};',
      '',
    ].join('\n'),
    expect: [[storyGlobals, "{ viewport: 'responsive' }"]],
  },
  {
    id: 'story-globals-viewport-under-meta-spread-parameters',
    title:
      "a story's default viewport gets no mutant when the parameters of a top-level object the meta spreads do not set viewport",
    source: [
      "const common = { parameters: { layout: 'centered' } };",
      "export default { title: 'Probe', ...common };",
      '',
      'export const Story = {',
      "  globals: { viewport: 'responsive', locale: 'fr' },",
      '  play: async () => {},',
      '};',
      '',
    ].join('\n'),
    expect: [[storyGlobals, "{ viewport: 'responsive' }"]],
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
    id: 'story-globals-default-over-imported-base',
    title:
      'an .extend() story gets a mutant of a default value of a global when its base is imported, as the base may set it',
    source: factoryFile(
      "import { Base } from './base.stories';",
      "export const Plain = Base.extend({ globals: { outline: false, locale: 'de' }, play: async () => {} });",
    ),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, '{ outline: false }'],
    ],
  },
  {
    id: 'story-globals-before-written-spread',
    title:
      "a story's own globals are a site when a later spread names a story the file writes globals to, as the file does not prove that the spread replaces them; the default outline still gets none",
    source: storyFile(
      'export const Base = { args: {} };',
      "Base.globals = { locale: 'fr' };",
      'export const Story = {',
      "  globals: { outline: false, locale: 'de' },",
      '  ...Base,',
      '  play: async () => {},',
      '};',
    ),
    expect: [[storyGlobals, '{ outline: false }']],
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
  {
    id: 'story-globals-replaced-by-computed-key',
    title:
      "a story's own globals before a computed key of an imported name are a site, as the file does not prove that the key replaces them",
    source: [
      "import { k } from './k';",
      '',
      "export default { title: 'Probe' };",
      '',
      "export const Story = { globals: { locale: 'fr' }, [k]: {}, play: async () => {} };",
      '',
    ].join('\n'),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-meta-duplicate-key',
    title:
      'a meta that writes globals twice has the last as its site, as that one replaces the first',
    source: [
      "export default { title: 'Probe', globals: { locale: 'de', outline: true }, globals: { locale: 'fr' } };",
      '',
      'export const Story = { play: async () => {} };',
      '',
    ].join('\n'),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-test-options-before-unresolved-spread',
    title:
      'the globals in .test() options before a spread of an imported object are a site, as the file does not prove that the spread replaces them',
    source: [
      "import { shared } from './shared';",
      '',
      "export default { title: 'Probe' };",
      '',
      'export const Story = {};',
      '',
      "Story.test('t', { globals: { locale: 'fr' }, ...shared }, async () => {});",
      '',
    ].join('\n'),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-test-options-before-computed-key',
    title:
      'the globals in .test() options before a computed key of an imported name are a site, as the file does not prove that the key replaces them',
    source: [
      "import { k } from './k';",
      '',
      "export default { title: 'Probe' };",
      '',
      'export const Story = {};',
      '',
      "Story.test('t', { globals: { locale: 'fr' }, [k]: {} }, async () => {});",
      '',
    ].join('\n'),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-meta-before-unresolved-spread',
    title:
      "the meta's globals before a spread of an imported object make no mutant, as the spread may replace them",
    source: [
      "import { shared } from './shared';",
      '',
      "export default { title: 'Probe', globals: { locale: 'de' }, ...shared };",
      '',
      "export const Story = { globals: { locale: 'fr' }, play: async () => {} };",
      '',
    ].join('\n'),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-meta-before-computed-key',
    title:
      "the meta's globals before a computed key of an imported name make no mutant, as that key may replace them",
    source: [
      "import { k } from './k';",
      '',
      "export default { title: 'Probe', globals: { locale: 'de' }, [k]: {} };",
      '',
      "export const Story = { globals: { locale: 'fr' }, play: async () => {} };",
      '',
    ].join('\n'),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-viewport-under-meta-unresolved-spread',
    title:
      "a story's responsive viewport under a meta whose parameters a spread may replace is no default, as the spread may set viewport",
    source: [
      "import { shared } from './shared';",
      '',
      "export default { title: 'Probe', parameters: {}, ...shared };",
      '',
      "export const Story = { globals: { viewport: { value: 'responsive' } }, play: async () => {} };",
      '',
    ].join('\n'),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-computed-key-named-globals',
    title:
      'an object under a computed key [globals] makes no mutant, as the constant it names gives another key',
    source: storyFile(
      "const globals = 'x';",
      "export const Story = { [globals]: { locale: 'de' }, play: async () => {} };",
    ),
    expect: [],
  },
  {
    id: 'story-globals-play-undefined-no-meta-play',
    title:
      'a story whose play is undefined under a meta with no play makes no mutant, as Storybook 10.6.5 runs no play for it',
    source: storyFile(
      "export const Story = { globals: { locale: 'de' }, play: undefined };",
    ),
    expect: [],
  },
];

export const storyGlobalsCrashCases: readonly Case[] = [
  {
    id: 'story-globals-prototype-key',
    title:
      'a global named after an Object.prototype member is no default global, so instrumenting finishes',
    source: storyFile(
      "export const Story = { globals: { __defineGetter__: 1, locale: 'de' }, play: async () => {} };",
    ),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, '{ __defineGetter__: 1 }'],
    ],
  },
  {
    id: 'story-globals-backgrounds-prototype-key',
    title:
      'a backgrounds global with a key named after an Object.prototype member is no default, so instrumenting finishes',
    source: storyFile(
      'export const Story = { globals: { backgrounds: { constructor: 1 } }, play: async () => {} };',
    ),
    expect: [[storyGlobals, '{}']],
  },
];
