import {
  type Case,
  factoryFile,
  metaFile,
  storyFile,
  storyGlobals,
} from './support/case.ts';

export const storyGlobalsDefaultCases: readonly Case[] = [
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
    source: metaFile(
      "{ title: 'Probe', parameters: { viewport: { defaultViewport: 'mobile1' } } }",
      "export const Story = { globals: { viewport: { value: 'responsive' } }, play: async () => {} };",
    ),
    expect: [[storyGlobals, '{}']],
  },
  {
    id: 'story-globals-viewport-under-written-meta-parameters',
    title:
      "a story's responsive viewport global gets a mutant when the file writes viewport parameters to the meta",
    source: [
      "const meta = { title: 'Probe' };",
      'export default meta;',
      "meta.parameters = { viewport: { defaultViewport: 'mobile1' } };",
      '',
      "export const Primary = { globals: { viewport: 'responsive', locale: 'de' }, play: async () => {} };",
      '',
    ].join('\n'),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, "{ viewport: 'responsive' }"],
    ],
  },
  {
    id: 'story-globals-viewport-under-written-story-parameters',
    title:
      "a story's responsive viewport global gets a mutant when the file writes viewport parameters to the story, as setViewport falls back to their defaultViewport",
    source: storyFile(
      "export const Primary = { globals: { viewport: 'responsive', locale: 'de' }, play: async () => {} };",
      "Primary.parameters = { viewport: { defaultViewport: 'mobile1' } };",
    ),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, "{ viewport: 'responsive' }"],
    ],
  },
  {
    id: 'story-globals-meta-viewport-over-story-parameters',
    title:
      "a responsive viewport global in the meta gets a mutant when a story it runs for sets viewport parameters, which merge over the meta's",
    source: metaFile(
      "{ title: 'Probe', globals: { viewport: { value: 'responsive' } } }",
      "export const Story = { parameters: { viewport: { defaultViewport: 'mobile1' } }, play: async () => {} };",
    ),
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
    id: 'story-globals-meta-default',
    title:
      "the meta's default value of a global makes no mutant, as the meta's own globals are not below themselves",
    source: metaFile(
      "{ title: 'Probe', globals: { outline: false, locale: 'de' } }",
      'export const Story = { play: async () => {} };',
    ),
    expect: [[storyGlobals, '{ outline: false }']],
  },
  {
    id: 'story-globals-default-after-spread',
    title:
      'a default value of a global after a spread in the same globals gets a mutant, as the spread may set that global',
    source: storyFile(
      'const base = { outline: true };',
      'export const Story = {',
      '  globals: { ...base, outline: false },',
      '  play: async () => {},',
      '};',
    ),
    expect: [
      [storyGlobals, '{ outline: false }'],
      [storyGlobals, '{ ...base }'],
    ],
  },
  {
    id: 'story-globals-viewport-method',
    title:
      'a viewport global written as a method gets a mutant, as only a value can be a default',
    source: storyFile(
      'export const Story = {',
      "  globals: { viewport() {}, locale: 'de' },",
      '  play: async () => {},',
      '};',
    ),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, '{ viewport() {} }'],
    ],
  },
  {
    id: 'story-globals-default-viewport-no-value',
    title:
      "a viewport object with no value makes no mutant, as the Vitest addon's setViewport reads only its value",
    source: storyFile(
      'export const Story = {',
      "  globals: { viewport: { isRotated: true }, locale: 'de' },",
      '  play: async () => {},',
      '};',
    ),
    expect: [[storyGlobals, '{ viewport: { isRotated: true } }']],
  },
  {
    id: 'story-globals-viewport-named-value',
    title:
      'a viewport object whose value names a constant gets a mutant, as only undefined and the default names are defaults',
    source: storyFile(
      "const phone = 'mobile1';",
      'export const Story = {',
      "  globals: { viewport: { value: phone }, locale: 'de' },",
      '  play: async () => {},',
      '};',
    ),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, '{ viewport: { value: phone } }'],
    ],
  },
  {
    id: 'story-globals-default-viewport-under-test-without-options',
    title:
      "a story's default viewport makes no mutant when the .test() call that runs it has no options",
    source: factoryFile(
      "export const Story = meta.story({ globals: { viewport: 'responsive', locale: 'de' } });",
      "Story.test('t', async () => {});",
    ),
    expect: [[storyGlobals, "{ viewport: 'responsive' }"]],
  },
  {
    id: 'story-globals-named-backgrounds',
    title:
      'a backgrounds global that names a top-level object gets a mutant, as only an object literal of initial values is a default',
    source: storyFile(
      "const dark = { value: 'dark' };",
      'export const Story = {',
      "  globals: { backgrounds: dark, locale: 'de' },",
      '  play: async () => {},',
      '};',
    ),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, '{ backgrounds: dark }'],
    ],
  },
  {
    id: 'story-globals-backgrounds-value',
    title:
      'a backgrounds global with a value gets a mutant, even with grid: false',
    source: storyFile(
      'export const Story = {',
      "  globals: { backgrounds: { value: 'dark', grid: false }, locale: 'de' },",
      '  play: async () => {},',
      '};',
    ),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, "{ backgrounds: { value: 'dark', grid: false } }"],
    ],
  },
  {
    id: 'story-globals-default-over-meta',
    title:
      "a story's default value of a global the meta sets gets a mutant, as removing it brings the meta's value back",
    source: metaFile(
      "{ title: 'Probe', globals: { outline: true, viewport: { value: 'mobile1' } } }",
      'export const Story = {',
      "  globals: { outline: false, viewport: { value: 'responsive' } },",
      '  play: async () => {},',
      '};',
    ),
    expect: [
      [storyGlobals, '{ outline: false }'],
      [storyGlobals, '{ outline: true }'],
      [storyGlobals, "{ viewport: { value: 'mobile1' } }"],
      [storyGlobals, "{ viewport: { value: 'responsive' } }"],
    ],
  },
  {
    id: 'story-globals-default-in-written-story',
    title:
      "a story's default value of a global gets a mutant when the file writes the story, as a write such as ??= may read that global",
    source: storyFile(
      "export const Primary = { globals: { outline: false, locale: 'de' }, play: async () => {} };",
      'Primary.globals.outline ??= true;',
    ),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, '{ outline: false }'],
    ],
  },
  {
    id: 'story-globals-default-over-written-meta',
    title:
      "a story's default value of a global gets a mutant when the file writes that global to the meta, as removing it brings the written value back",
    source: [
      "const meta = { title: 'Probe', globals: { locale: 'de' }, play: async () => {} };",
      'export default meta;',
      'meta.globals.outline = true;',
      '',
      "export const Primary = { globals: { outline: false, locale: 'fr' } };",
      '',
    ].join('\n'),
    expect: [
      [storyGlobals, '{}'],
      [storyGlobals, "{ locale: 'fr' }"],
      [storyGlobals, '{ outline: false }'],
    ],
  },
  {
    id: 'story-globals-default-over-written-factory-meta',
    title:
      "a factory story's default value of a global gets a mutant when the file writes that global to the factory meta's input",
    source: [
      "import preview from '../.storybook/preview';",
      '',
      "const meta = preview.meta({ title: 'Probe', globals: { locale: 'de' } });",
      'meta.input.globals.outline = true;',
      '',
      "export const Primary = meta.story({ globals: { outline: false, locale: 'fr' }, play: async () => {} });",
      '',
    ].join('\n'),
    expect: [
      [storyGlobals, '{}'],
      [storyGlobals, "{ locale: 'fr' }"],
      [storyGlobals, '{ outline: false }'],
    ],
  },
  {
    id: 'story-globals-default-in-written-meta',
    title:
      "the meta's default value of a global gets a mutant when the file writes the meta, as a write such as ??= may read that global",
    source: [
      "const meta = { title: 'Probe', globals: { outline: false, locale: 'de' } };",
      'export default meta;',
      'meta.globals.outline ??= true;',
      '',
      'export const Primary = { play: async () => {} };',
      '',
    ].join('\n'),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, '{ outline: false }'],
    ],
  },
  {
    id: 'story-globals-default-read-in-other-story',
    title:
      "a story's default value of a global gets a mutant when another story reads it when the file loads",
    source: storyFile(
      "export const Primary = { globals: { outline: false, locale: 'de' }, play: async () => {} };",
      'export const Other = { globals: { outline: Primary.globals.outline }, play: async () => {} };',
    ),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, '{ outline: false }'],
      [storyGlobals, '{}'],
    ],
  },
  {
    id: 'story-globals-default-member-spread-read-in-other-story',
    title:
      'a default value of a global gets a mutant when the story spreads a member of a top-level object that another story reads when the file loads',
    source: storyFile(
      'const lib = { story: { globals: { outline: false, measureEnabled: true } } };',
      'export const Primary = { ...lib.story, play: async () => {} };',
      'export const Other = { globals: { measureEnabled: lib.story.globals.outline }, play: async () => {} };',
    ),
    expect: [
      [storyGlobals, '{ measureEnabled: true }'],
      [storyGlobals, '{ outline: false }'],
      [storyGlobals, '{}'],
    ],
  },
  {
    id: 'story-globals-default-before-setter',
    title:
      "a story's default value of a global gets a mutant while a setter of that global is in the object, as the proofs do not read accessors",
    source: storyFile(
      "export const Primary = { globals: { outline: false, set outline(v) {}, locale: 'de' }, play: async () => {} };",
    ),
    expect: [
      [storyGlobals, "{ set outline(v) {}, locale: 'de' }"],
      [storyGlobals, "{ outline: false, locale: 'de' }"],
      [storyGlobals, '{ outline: false, set outline(v) {} }'],
    ],
  },
  {
    id: 'story-globals-meta-default-member-spread-read-in-story',
    title:
      "the meta's default value of a global gets a mutant when the meta spreads a member of a top-level object that a story reads when the file loads",
    source: [
      'const lib = { meta: { globals: { outline: false, measureEnabled: true } } };',
      "export default { title: 'Probe', ...lib.meta };",
      '',
      'export const Primary = { play: async () => {} };',
      'export const Other = { globals: { measureEnabled: lib.meta.globals.outline }, play: async () => {} };',
      '',
    ].join('\n'),
    expect: [
      [storyGlobals, '{ measureEnabled: true }'],
      [storyGlobals, '{ outline: false }'],
      [storyGlobals, '{}'],
    ],
  },
  {
    id: 'story-globals-meta-default-read-in-story',
    title:
      "the meta's default value of a global gets a mutant when a story reads it when the file loads",
    source: [
      "const meta = { title: 'Probe', globals: { outline: false, locale: 'de' } };",
      'export default meta;',
      '',
      'export const Primary = { globals: { outline: meta.globals.outline }, play: async () => {} };',
      '',
    ].join('\n'),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, '{ outline: false }'],
      [storyGlobals, '{}'],
    ],
  },
  {
    id: 'story-globals-default-spread-in-other-story-after-key',
    title:
      "a story's default value of a global gets a mutant when another story spreads its globals after a value of its own, which the global then falls back to",
    source: storyFile(
      "export const Primary = { globals: { outline: false, locale: 'de' }, play: async () => {} };",
      'export const Other = { globals: { outline: true, ...Primary.globals }, play: async () => {} };',
    ),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, '{ outline: false }'],
      [storyGlobals, '{ ...Primary.globals }'],
      [storyGlobals, '{ outline: true }'],
    ],
  },
  {
    id: 'story-globals-test-options-constant-default-read-in-other-story',
    title:
      'a default value of a global in a .test() options constant gets a mutant when another story reads it when the file loads',
    source: storyFile(
      'export const Primary = { play: async () => {} };',
      "const options = { globals: { outline: false, locale: 'fr' } };",
      "Primary.test('t', options, async () => {});",
      'export const Other = { globals: { outline: options.globals.outline }, play: async () => {} };',
    ),
    expect: [
      [storyGlobals, "{ locale: 'fr' }"],
      [storyGlobals, '{ outline: false }'],
      [storyGlobals, '{}'],
    ],
  },
  {
    id: 'story-globals-meta-default-beside-other-meta',
    title:
      "a meta's default value of a global gets a mutant when another meta of the file sets that global, as either meta may be the one below the story",
    source: factoryFile(
      "export default { title: 'Other', globals: { outline: true } };",
      "const second = preview.meta({ globals: { outline: false, locale: 'de' } });",
      'export const Primary = second.story({ play: async () => {} });',
    ),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, '{ outline: false }'],
      [storyGlobals, '{}'],
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
      "a story's own globals are a site when a later spread names a story the file writes globals to, as the file does not prove that the spread replaces them, and the default outline gets its mutant, as that write reaches the story",
    source: storyFile(
      'export const Base = { args: {} };',
      "Base.globals = { locale: 'fr' };",
      'export const Story = {',
      "  globals: { outline: false, locale: 'de' },",
      '  ...Base,',
      '  play: async () => {},',
      '};',
    ),
    expect: [
      [storyGlobals, "{ locale: 'de' }"],
      [storyGlobals, '{ outline: false }'],
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
    id: 'story-globals-test-options-over-written-story',
    title:
      'the options of a .test() call get a mutant of a default value of a global when the file writes that global to the story, as removing it brings the written value back',
    source: storyFile(
      "export const Primary = { globals: { locale: 'de' }, play: async () => {} };",
      'Primary.globals.outline = true;',
      "Primary.test('t', { globals: { outline: false, locale: 'fr' } }, async () => {});",
    ),
    expect: [
      [storyGlobals, '{}'],
      [storyGlobals, "{ locale: 'fr' }"],
      [storyGlobals, '{ outline: false }'],
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
];
