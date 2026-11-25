import {
  muirMutantsByKey,
  muirOneLine,
  type MuirMutantStatus,
  type MuirReport,
} from './report.ts';

interface Entry {
  readonly label: string;
  readonly status: MuirMutantStatus;
}

/**
 * Each mutant whose status differs, or that one report lacks. Mutants are keyed as Stryker's incremental mode keys
 * them: file, location, mutator and replacement, which tells apart the mutants one mutator makes at one place.
 */
export function muirCompareReports(
  first: MuirReport,
  second: MuirReport,
): string[] {
  const firstEntries = entriesByKey(first);
  const secondEntries = entriesByKey(second);
  const differences: string[] = [];

  const labels = new Map(
    [...firstEntries, ...secondEntries].map(([key, { label }]) => [key, label]),
  );

  for (const [key, label] of labels) {
    const firstStatus = firstEntries.get(key)?.status ?? 'absent';
    const secondStatus = secondEntries.get(key)?.status ?? 'absent';

    if (firstStatus !== secondStatus) {
      differences.push(`${label}: ${firstStatus} -> ${secondStatus}`);
    }
  }

  return differences;
}

function entriesByKey(report: MuirReport): Map<string, Entry> {
  return new Map(
    [...muirMutantsByKey(report)].map(
      ([key, { file, mutant }]): [string, Entry] => {
        const {
          line,
          column,
          endLine,
          endColumn,
          mutator,
          replacement,
          status,
        } = mutant;
        const label = `${file}@${line}:${column}-${endLine}:${endColumn} ${mutator}: ${muirOneLine(replacement)}`;

        return [key, { label, status }];
      },
    ),
  );
}
