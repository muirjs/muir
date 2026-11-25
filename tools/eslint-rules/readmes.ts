/** The backticked `muir` and `Muir` names in a README's `## Exports` section; none without that section. */
export function documentedExports(text: string): string[] {
  // Stryker disable next-line MuirProteusJsNumericLiteral: the whole match adds only the heading line, which holds no backticked name
  const section = /^## Exports\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1];

  return [...(section?.matchAll(/`([Mm]uir[A-Za-z0-9]*)`/g) ?? [])].map(
    // Stryker disable next-line StringLiteral: the capture group is not optional, so a match always holds the name
    ([, name]) => name ?? '',
  );
}

/** `MuirMoiraMutators` for `moira-mutators`: the prefix of the package's names, which a README may name. */
export function prefixOf(name: string): string {
  return `Muir${name
    .split('-')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join('')}`;
}
