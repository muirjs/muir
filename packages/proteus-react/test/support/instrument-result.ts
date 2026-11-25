import { muirMoiraMutatorsFieldOf } from '@muirjs/moira-mutators';
import type { MutantStatus, Position } from '@stryker-mutator/api/core';

import {
  muirMoiraMutatorsCoreInstrument,
  type MuirProteusReactInstrumenter,
  type MuirMoiraMutatorsSourceFile,
} from '../../src/install.ts';
import { muirProteusReactPackageName } from '../../src/package-name.ts';

export interface InstrumentedMutant {
  readonly id: string;
  readonly fileName: string;
  readonly mutatorName: string;
  readonly replacement: string;
  readonly location: {
    readonly start: Readonly<Position>;
    readonly end: Readonly<Position>;
  };
  readonly status?: MutantStatus | undefined;
  readonly statusReason?: string | undefined;
}

export interface InstrumentResult {
  readonly files: readonly MuirMoiraMutatorsSourceFile[];
  readonly mutants: readonly InstrumentedMutant[];
}

const statuses: readonly MutantStatus[] = [
  'Killed',
  'Survived',
  'NoCoverage',
  'CompileError',
  'RuntimeError',
  'Timeout',
  'Ignored',
  'Pending',
];

export async function instrumentFully(
  instrumenter: MuirProteusReactInstrumenter,
  files: readonly MuirMoiraMutatorsSourceFile[],
  excludedMutations: readonly string[] = [],
): Promise<InstrumentResult> {
  const instrument = await muirMoiraMutatorsCoreInstrument({
    packageName: muirProteusReactPackageName,
    ...instrumenter,
  });
  const result = await instrument(files, excludedMutations, []);
  const fileList = muirMoiraMutatorsFieldOf(result, 'files');
  const mutants = muirMoiraMutatorsFieldOf(result, 'mutants');

  if (!Array.isArray(fileList) || !Array.isArray(mutants)) {
    throw changed('files or mutants');
  }

  return {
    files: fileList.map((file: unknown) => ({
      name: stringOf(file, 'name'),
      content: stringOf(file, 'content'),
    })),
    mutants: mutants.map((mutant: unknown) => {
      const location = muirMoiraMutatorsFieldOf(mutant, 'location');
      const status = muirMoiraMutatorsFieldOf(mutant, 'status');
      const statusReason = muirMoiraMutatorsFieldOf(mutant, 'statusReason');

      return {
        id: stringOf(mutant, 'id'),
        fileName: stringOf(mutant, 'fileName'),
        mutatorName: stringOf(mutant, 'mutatorName'),
        replacement: stringOf(mutant, 'replacement'),
        location: {
          start: positionOf(muirMoiraMutatorsFieldOf(location, 'start')),
          end: positionOf(muirMoiraMutatorsFieldOf(location, 'end')),
        },
        status: status === undefined ? undefined : statusOf(status),
        statusReason:
          statusReason === undefined
            ? undefined
            : stringOf(mutant, 'statusReason'),
      };
    }),
  };
}

function changed(what: string): Error {
  return new Error(`Instrumenter.instrument() gave no valid ${what}`);
}

function stringOf(value: unknown, key: string): string {
  const found = muirMoiraMutatorsFieldOf(value, key);

  if (typeof found !== 'string') {
    throw changed(key);
  }

  return found;
}

function positionOf(value: unknown): Position {
  const numberOf = (key: string): number => {
    const found = muirMoiraMutatorsFieldOf(value, key);

    if (typeof found !== 'number') {
      throw changed(`location ${key}`);
    }

    return found;
  };

  return { line: numberOf('line'), column: numberOf('column') };
}

function statusOf(value: unknown): MutantStatus {
  const known = statuses.find((status) => status === value);

  if (known === undefined) {
    throw changed('status');
  }

  return known;
}
