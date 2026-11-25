import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { field } from '@layzee/storybook-core';
import type { schema } from '@stryker-mutator/api/core';
import type { Ignorer } from '@stryker-mutator/api/ignore';

export interface Instrumented {
  readonly code: string;
  readonly mutants: readonly InstrumentedMutant[];
  readonly warnings: readonly string[];
}

export interface InstrumentedMutant {
  readonly mutatorName: string;
  readonly line: number;
  /** As the mutation report gives it: line and column both 1-based. */
  readonly location: schema.Location;
  readonly replacement: string;
  readonly ignoreReason: string | undefined;
}

const core = createRequire(import.meta.url).resolve(
  '@stryker-mutator/core/package.json',
);
const instrumenterDir = dirname(
  createRequire(core).resolve('@stryker-mutator/instrumenter/package.json'),
);
const instrumenterModule: unknown = await import(
  pathToFileURL(join(instrumenterDir, 'dist', 'src', 'index.js')).href
);

/** Instruments one file with StrykerJS's own instrumenter, every built-in mutator and the given ignorers. */
export async function instrument(
  fileName: string,
  content: string,
  ignorers: readonly Ignorer[],
): Promise<Instrumented> {
  const Instrumenter = field(instrumenterModule, 'Instrumenter');
  const warnings: string[] = [];
  const logger = {
    isDebugEnabled: () => false,
    isTraceEnabled: () => false,
    debug: () => undefined,
    trace: () => undefined,
    info: () => undefined,
    warn: (message: unknown) => warnings.push(String(message)),
    error: (message: unknown) => warnings.push(String(message)),
    fatal: (message: unknown) => warnings.push(String(message)),
  };

  if (typeof Instrumenter !== 'function') {
    throw new Error('the Stryker instrumenter exports no Instrumenter class');
  }

  const instrumenter: unknown = Reflect.construct(Instrumenter, [logger]);
  const instrumentMethod = field(instrumenter, 'instrument');

  if (typeof instrumentMethod !== 'function') {
    throw new Error('the Stryker instrumenter has no instrument method');
  }

  const result: unknown = await Reflect.apply(instrumentMethod, instrumenter, [
    [{ name: fileName, content, mutate: true }],
    { plugins: null, excludedMutations: [], ignorers },
  ]);
  const files = field(result, 'files');
  const mutants = field(result, 'mutants');
  const code = Array.isArray(files) ? field(files[0], 'content') : undefined;

  if (typeof code !== 'string' || !Array.isArray(mutants)) {
    throw new Error('Instrumenter.instrument() gave no files or mutants');
  }

  return {
    code,
    warnings,
    mutants: mutants.map((mutant: unknown) => {
      const mutatorName = field(mutant, 'mutatorName');
      const start = schemaPosition(field(mutant, 'location', 'start'));
      const end = schemaPosition(field(mutant, 'location', 'end'));
      const replacement = field(mutant, 'replacement');
      const statusReason = field(mutant, 'statusReason');

      if (
        typeof mutatorName !== 'string' ||
        start === undefined ||
        end === undefined ||
        typeof replacement !== 'string'
      ) {
        throw new Error(
          'Instrumenter.instrument() gave a mutant of an unknown shape',
        );
      }

      return {
        mutatorName,
        line: start.line,
        location: { start, end },
        replacement,
        ignoreReason:
          field(mutant, 'status') === 'Ignored' &&
          typeof statusReason === 'string'
            ? statusReason
            : undefined,
      };
    }),
  };
}

/** StrykerJS 10.1.1 `objectUtils.toSchemaPosition`: its 0-based position, 1-based as in the report. */
function schemaPosition(position: unknown): schema.Position | undefined {
  const line = field(position, 'line');
  const column = field(position, 'column');

  return typeof line === 'number' && typeof column === 'number'
    ? { line: line + 1, column: column + 1 }
    : undefined;
}
