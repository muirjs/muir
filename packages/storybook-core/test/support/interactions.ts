import { csfShapes } from '../../src/csf.ts';
import { type Interaction, interactionsOf } from '../../src/interactions.ts';
import { programsOf } from './parse-module.ts';
import { inPlayWith } from './story-source.ts';

export interface KindCase {
  readonly title: string;
  readonly source: string;
  /** Each interaction of the file, in source order, as `describeInteraction` gives it. */
  readonly expect: readonly string[];
}

export function inPlay(...statements: readonly string[]): string {
  return inPlayWith(['canvas', 'userEvent'], ...statements);
}

/** The kind of an interaction, with its method (`?` for an unknown key), its user-event origin, a step body statement and a hook. */
function describeInteraction(interaction: Interaction): string {
  return [
    interaction.kind,
    ...(interaction.kind === 'userEvent' || interaction.kind === 'fireEvent'
      ? [interaction.method ?? '?']
      : []),
    ...(interaction.kind === 'userEvent' ? [interaction.origin] : []),
    ...(interaction.statement === 'stepBody' ? ['stepBody'] : []),
    ...(interaction.inHook ? ['inHook'] : []),
  ].join(' ');
}

/** The interactions of `source`, described, once per parse. */
export function interactionsIn(source: string): readonly (readonly string[])[] {
  return programsOf(source).map((program) =>
    interactionsOf(program, csfShapes(program)).all.map(describeInteraction),
  );
}
