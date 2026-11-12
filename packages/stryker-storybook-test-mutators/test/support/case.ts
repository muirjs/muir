export interface Case {
  readonly id: string;
  readonly title: string;
  /** A story file. */
  readonly source: string;
  /** The mutants the mutators make: [mutator name, replacement]. */
  readonly expect: readonly (readonly [string, string])[];
}

export function inPlay(...statements: readonly string[]): string {
  return inPlayWith(['canvas', 'userEvent'], ...statements);
}

/** A story whose play destructures `contextKeys` from its context and runs `statements`. */
export function inPlayWith(
  contextKeys: readonly string[],
  ...statements: readonly string[]
): string {
  return `export const Story = {\n  play: async ({ ${contextKeys.join(', ')} }) => {\n    ${statements.join('\n    ')}\n  },\n};\n`;
}
