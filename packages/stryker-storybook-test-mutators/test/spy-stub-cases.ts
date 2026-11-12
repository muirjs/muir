import { type Case, inPlay, withFnImport } from './support/case.ts';

const spyStub = 'LzStorybookSpyStub';

export const spyStubCases: readonly Case[] = [
  {
    id: 'spy-stub-args',
    title: 'a stub chained on fn() in story args leaves the bare fn() call',
    source: withFnImport(
      'export const Story = {',
      "  args: { getValue: fn().mockReturnValue('stubbed') },",
      '};',
    ),
    expect: [[spyStub, 'fn()']],
  },
  {
    id: 'spy-stub-resolved-no-outcome',
    title:
      'a resolved stub gets only the removal mutant, as its outcome mutant is LzStorybookSpyStubOutcome',
    source: withFnImport(
      'export const Story = {',
      '  args: { save: fn().mockResolvedValue({ id: 1 }) },',
      '};',
    ),
    expect: [[spyStub, 'fn()']],
  },
  {
    id: 'spy-stub-once',
    title: 'a Once stub chained on fn() leaves the bare fn() call',
    source: withFnImport(
      'export const Story = {',
      '  args: { save: fn().mockResolvedValueOnce(1) },',
      '};',
    ),
    expect: [[spyStub, 'fn()']],
  },
  {
    id: 'spy-stub-chain',
    title:
      'each stub in a chain on fn() is removed on its own, leaving the stubs before it',
    source: withFnImport(
      'export const Story = {',
      "  args: { save: fn().mockResolvedValueOnce(1).mockRejectedValueOnce(new Error('x')) },",
      '};',
    ),
    expect: [
      [spyStub, 'fn()'],
      [spyStub, 'fn().mockResolvedValueOnce(1)'],
    ],
  },
  {
    id: 'spy-stub-chain-on-unknown-spy',
    title:
      'a chain of stubs on a spy that fn() from storybook/test did not make makes no mutant',
    source: withFnImport(
      'export const Story = {',
      '  args: { load: vi.fn().mockReturnValueOnce(1).mockReturnValue(2) },',
      '};',
    ),
    expect: [],
  },
  {
    id: 'spy-stub-named-after-stub',
    title:
      'a stub chained on fn() and then named leaves the bare fn() call, and the mockName call around it makes no mutant',
    source: withFnImport(
      'export const Story = {',
      "  args: { save: fn().mockResolvedValue({ id: 1 }).mockName('save') },",
      '};',
    ),
    expect: [[spyStub, 'fn()']],
  },
  {
    id: 'spy-stub-in-render',
    title:
      'a stub chained on fn() inside a function runs at render, so it makes no mutant',
    source: withFnImport(
      'export const Story = {',
      "  render: () => Probe({ getValue: fn().mockReturnValue('stubbed') }),",
      '};',
    ),
    expect: [],
  },
  {
    id: 'spy-stub-statement-in-play',
    title: 'a stub statement in a play is removed',
    source: inPlay("mocked(getValue).mockReturnValue('stubbed');"),
    expect: [[spyStub, ';']],
  },
  {
    id: 'spy-stub-statement-in-render',
    title: 'a stub statement outside story test code makes no mutant',
    source: withFnImport(
      'export const Story = {',
      '  render: () => {',
      "    mocked(getValue).mockReturnValue('stubbed');",
      '    return Probe();',
      '  },',
      '};',
    ),
    expect: [],
  },
  {
    id: 'spy-stub-statement-in-before-each',
    title: 'a stub statement in a story beforeEach is removed',
    source: withFnImport(
      'export const Story = {',
      '  beforeEach: () => {',
      "    mocked(getValue).mockReturnValue('stubbed');",
      '  },',
      '};',
    ),
    expect: [[spyStub, ';']],
  },
  {
    id: 'spy-stub-optional-call',
    title: 'an optional-chained stub statement is removed as a plain one is',
    source: inPlay('mocked(save)?.mockResolvedValue(note);'),
    expect: [[spyStub, ';']],
  },
  {
    id: 'spy-stub-computed-member',
    title:
      'a call on a computed member named by a variable is no stub statement, as the variable may hold any method name',
    source: inPlay('obj[mockResolvedValue](note);'),
    expect: [],
  },
];
