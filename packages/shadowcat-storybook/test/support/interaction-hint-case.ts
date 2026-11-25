import type { schema } from '@stryker-mutator/api/core';

import type { MuirShadowcatStorybookInteractionShape } from '../../src/interaction-shapes.ts';

/** A surviving mutant as [mutator name, 1-based line], or with the 1-based column it starts at when the line holds another mutant of that mutator that does not survive. */
export type Survivor = readonly [string, number, number?];

export interface InteractionHintCase {
  readonly id: string;
  readonly title: string;
  /** A story file. */
  readonly source: string;
  /** The mutants that survive; every other mutant is Killed, or Ignored when Stryker ignores it. */
  readonly survived: readonly Survivor[];
  /** The hints, as [line, shape, mutator names]. */
  readonly expect: readonly (readonly [
    number,
    MuirShadowcatStorybookInteractionShape,
    readonly string[],
  ])[];
}

/** Whether `survived` lists the mutant of `mutatorName` that starts at `start`. */
export function survives(
  survived: readonly Survivor[],
  mutatorName: string,
  start: schema.Position,
): boolean {
  return survived.some(
    ([name, line, column]) =>
      name === mutatorName &&
      line === start.line &&
      (column === undefined || column === start.column),
  );
}

/** The first statement is on line 5. */
export function inPlay(...statements: readonly string[]): string {
  return [
    "export default { title: 'Form' };",
    '',
    'export const Form = {',
    '  play: async ({ args, canvas, step, userEvent }) => {',
    ...statements.map((statement) => `    ${statement}`),
    '  },',
    '};',
    '',
  ].join('\n');
}
