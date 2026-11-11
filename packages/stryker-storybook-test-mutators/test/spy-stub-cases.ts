import { type Case, inPlay } from './support/case.ts';

const spyStub = 'LzStorybookSpyStub';

function storyFile(...lines: readonly string[]): string {
  return `import { fn } from 'storybook/test';\n\n${lines.join('\n')}\n`;
}

export const spyStubCases: readonly Case[] = [
  {
    id: 'spy-stub-args',
    title: 'a stub chained on fn() in story args leaves the bare fn() call',
    source: storyFile(
      'export const Story = {',
      "  args: { getValue: fn().mockReturnValue('stubbed') },",
      '};',
    ),
    expect: [[spyStub, 'fn()']],
  },
  {
    id: 'spy-stub-resolved-outcome',
    title:
      'a resolved stub also rejects with an Error instead, as the outcome mutant',
    source: storyFile(
      'export const Story = {',
      '  args: { save: fn().mockResolvedValue({ id: 1 }) },',
      '};',
    ),
    expect: [
      [spyStub, 'fn()'],
      [spyStub, 'fn().mockRejectedValue(new Error("Stryker"))'],
    ],
  },
  {
    id: 'spy-stub-rejected-outcome',
    title: 'a rejected stub also resolves to undefined, as the outcome mutant',
    source: storyFile(
      'export const Story = {',
      "  args: { save: fn().mockRejectedValue(new Error('offline')) },",
      '};',
    ),
    expect: [
      [spyStub, 'fn()'],
      [spyStub, 'fn().mockResolvedValue(undefined)'],
    ],
  },
  {
    id: 'spy-stub-once-outcome',
    title: 'the outcome mutant of a Once stub stays a Once stub',
    source: storyFile(
      'export const Story = {',
      '  args: { save: fn().mockResolvedValueOnce(1) },',
      '};',
    ),
    expect: [
      [spyStub, 'fn()'],
      [spyStub, 'fn().mockRejectedValueOnce(new Error("Stryker"))'],
    ],
  },
  {
    id: 'spy-stub-in-render',
    title:
      'a stub chained on fn() inside a function runs at render, so it makes no mutant',
    source: storyFile(
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
    source: storyFile(
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
    source: storyFile(
      'export const Story = {',
      '  beforeEach: () => {',
      "    mocked(getValue).mockReturnValue('stubbed');",
      '  },',
      '};',
    ),
    expect: [[spyStub, ';']],
  },
  {
    id: 'spy-stub-statement-outcome',
    title:
      'a resolved stub statement also rejects with an Error instead, as the outcome mutant',
    source: inPlay('mocked(save).mockResolvedValue(note);'),
    expect: [
      [spyStub, ';'],
      [spyStub, 'mocked(save).mockRejectedValue(new Error("Stryker"))'],
    ],
  },
  {
    id: 'spy-stub-optional-call',
    title:
      'an optional-chained stub statement gets the same mutants as a plain one',
    source: inPlay('mocked(save)?.mockResolvedValue(note);'),
    expect: [
      [spyStub, ';'],
      [spyStub, 'mocked(save)?.mockRejectedValue(new Error("Stryker"))'],
    ],
  },
  {
    id: 'spy-stub-computed-member',
    title:
      'a call on a computed member named by a variable is no stub statement, as the variable may hold any method name',
    source: inPlay('obj[mockResolvedValue](note);'),
    expect: [],
  },
];
