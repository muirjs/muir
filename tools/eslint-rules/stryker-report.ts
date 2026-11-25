// What the checks on Stryker's JSON report read of it.

export interface MuirMutant {
  readonly mutatorName: string;
  readonly status: string;
  readonly statusReason: string | undefined;
  readonly line: number;
  readonly column: number;
}

const malformedReport =
  "The mutation report does not match Stryker's JSON report schema.";

export function muirIsRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMutant(value: unknown): MuirMutant {
  const location = muirIsRecord(value) ? value['location'] : undefined;
  const start = muirIsRecord(location) ? location['start'] : undefined;

  if (
    !muirIsRecord(value) ||
    !muirIsRecord(start) ||
    typeof value['mutatorName'] !== 'string' ||
    typeof value['status'] !== 'string' ||
    !['string', 'undefined'].includes(typeof value['statusReason']) ||
    typeof start['line'] !== 'number' ||
    typeof start['column'] !== 'number'
  ) {
    throw new Error(malformedReport);
  }

  return {
    mutatorName: value['mutatorName'],
    status: value['status'],
    statusReason:
      typeof value['statusReason'] === 'string'
        ? value['statusReason']
        : undefined,
    line: start['line'],
    column: start['column'],
  };
}

/** The mutants of Stryker's JSON report per file; throws when the report does not match its schema. */
export function muirParseReport(
  report: unknown,
): readonly (readonly [file: string, mutants: readonly MuirMutant[]])[] {
  const files = muirIsRecord(report) ? report['files'] : undefined;

  if (!muirIsRecord(files)) {
    throw new Error(malformedReport);
  }

  return Object.entries(files).map(([file, result]) => {
    const mutants = muirIsRecord(result) ? result['mutants'] : undefined;

    if (!Array.isArray(mutants)) {
      throw new Error(malformedReport);
    }

    return [file, mutants.map(parseMutant)];
  });
}
