export interface Case {
  readonly id: string;
  readonly title: string;
  /** A story file. */
  readonly source: string;
  /** The mutants this package's mutators make: [mutator name, replacement]. */
  readonly expect: readonly (readonly [string, string])[];
}

export function inFactoryFile(...statements: readonly string[]): string {
  return `import preview from '../.storybook/preview';\n${statements.join('\n')}\n`;
}

export function inStory(...properties: readonly string[]): string {
  return `export default { title: 'Button' };\nexport const Primary = {\n  ${properties.join('\n  ')}\n};\n`;
}
