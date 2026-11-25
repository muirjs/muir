import { type Case, factoryFile, storyFile } from './support/case.ts';

const storyGlobals = 'MuirProteusStorybookTestStoryGlobals';

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
      "a story whose play only a spread of an imported object may set gets its own and the meta's globals mutants, as the file does not prove that the spread sets no play",
    source: [
      "import { Shared } from './shared';",
      '',
      "export default { title: 'Probe', globals: { locale: 'de' } };",
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
      "a story's globals before a spread that sets globals make no mutant, as the spread replaces them, and the spread object's globals get theirs",
    source: storyFile(
      "const Base = { globals: { locale: 'de' }, play: async () => {} };",
      "export const Story = { globals: { locale: 'fr' }, ...Base };",
    ),
    expect: [[storyGlobals, '{}']],
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
      "the meta's globals before a spread of an imported object are a site, as the file does not prove that the spread replaces them",
    source: [
      "import { shared } from './shared';",
      '',
      "export default { title: 'Probe', globals: { locale: 'de' }, ...shared };",
      '',
      "export const Story = { globals: { locale: 'fr' }, play: async () => {} };",
      '',
    ].join('\n'),
    expect: [
      [storyGlobals, '{}'],
      [storyGlobals, '{}'],
    ],
  },
  {
    id: 'story-globals-meta-before-computed-key',
    title:
      "the meta's globals before a computed key of an imported name are a site, as the file does not prove that the key replaces them",
    source: [
      "import { k } from './k';",
      '',
      "export default { title: 'Probe', globals: { locale: 'de' }, [k]: {} };",
      '',
      "export const Story = { globals: { locale: 'fr' }, play: async () => {} };",
      '',
    ].join('\n'),
    expect: [
      [storyGlobals, '{}'],
      [storyGlobals, '{}'],
    ],
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
