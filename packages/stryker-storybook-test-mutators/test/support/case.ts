export interface Case {
  readonly id: string;
  readonly title: string;
  /** A story file. */
  readonly source: string;
  /** The mutants the mutators make: [mutator name, replacement]. */
  readonly expect: readonly (readonly [string, string])[];
}

export function metaFile(meta: string, ...lines: readonly string[]): string {
  return `export default ${meta};\n\n${lines.join('\n')}\n`;
}

export function storyFile(...lines: readonly string[]): string {
  return metaFile("{ title: 'Probe' }", ...lines);
}

export function factoryFile(...lines: readonly string[]): string {
  return `import preview from '../.storybook/preview';\n\nconst meta = preview.meta({ title: 'Probe' });\n\n${lines.join('\n')}\n`;
}

export function withFnImport(...lines: readonly string[]): string {
  return `import { fn } from 'storybook/test';\n\n${lines.join('\n')}\n`;
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
