import { type Case, fnStoryFile, inPlay } from './support/case.ts';

const outcome = 'LzStorybookSpyStubOutcome';

export const spyStubOutcomeCases: readonly Case[] = [
  {
    id: 'spy-stub-outcome-resolved',
    title: 'a resolved stub rejects with an Error instead',
    source: fnStoryFile(
      'export const Story = {',
      '  args: { save: fn().mockResolvedValue({ id: 1 }) },',
      '};',
    ),
    expect: [[outcome, 'fn().mockRejectedValue(new Error("Stryker"))']],
  },
  {
    id: 'spy-stub-outcome-rejected',
    title: 'a rejected stub resolves to undefined instead',
    source: fnStoryFile(
      'export const Story = {',
      "  args: { save: fn().mockRejectedValue(new Error('offline')) },",
      '};',
    ),
    expect: [[outcome, 'fn().mockResolvedValue(undefined)']],
  },
  {
    id: 'spy-stub-outcome-once',
    title: 'the outcome mutant of a Once stub stays a Once stub',
    source: fnStoryFile(
      'export const Story = {',
      '  args: { save: fn().mockResolvedValueOnce(1) },',
      '};',
    ),
    expect: [[outcome, 'fn().mockRejectedValueOnce(new Error("Stryker"))']],
  },
  {
    id: 'spy-stub-outcome-statement',
    title: 'a resolved stub statement in a play rejects with an Error instead',
    source: inPlay('mocked(save).mockResolvedValue(note);'),
    expect: [[outcome, 'mocked(save).mockRejectedValue(new Error("Stryker"))']],
  },
  {
    id: 'spy-stub-outcome-optional-call',
    title: 'an optional-chained stub statement gets the same outcome mutant',
    source: inPlay('mocked(save)?.mockResolvedValue(note);'),
    expect: [
      [outcome, 'mocked(save)?.mockRejectedValue(new Error("Stryker"))'],
    ],
  },
];
