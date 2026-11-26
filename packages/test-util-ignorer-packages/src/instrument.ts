import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import {
  muirMoiraMutatorsCorePackageJsons,
  muirMoiraMutatorsFieldOf,
} from '@muirjs/moira-mutators';
import type { schema } from '@stryker-mutator/api/core';
import type { Ignorer } from '@stryker-mutator/api/ignore';

export interface MuirInstrumented {
  readonly code: string;
  readonly mutants: readonly MuirInstrumentedMutant[];
  readonly warnings: readonly string[];
}

export interface MuirInstrumentedMutant {
  readonly mutatorName: string;
  readonly line: number;
  /** As the mutation report gives it: line and column both 1-based. */
  readonly location: schema.Location;
  readonly replacement: string;
  readonly ignoreReason: string | undefined;
}

/** Instruments one file with StrykerJS's own instrumenter, every built-in mutator and the given ignorers. */
export async function muirInstrument(
  fileName: string,
  content: string,
  ignorers: readonly Ignorer[],
): Promise<MuirInstrumented> {
  // The entry the instrumenter's package exports, the one Stryker core imports.
  const entry = createRequire(muirMoiraMutatorsCorePackageJsons()[0]).resolve(
    '@stryker-mutator/instrumenter',
  );
  const Instrumenter = muirMoiraMutatorsFieldOf(
    await import(pathToFileURL(entry).href),
    'Instrumenter',
  );

  if (typeof Instrumenter !== 'function') {
    // Stryker disable next-line StringLiteral: only another StrykerJS version can change the instrumenter's shape
    throw new Error('the Stryker instrumenter exports no Instrumenter class');
  }

  const warnings: string[] = [];
  // The logger methods StrykerJS 10.1.1's instrumenter calls; only its warnings reach the caller.
  const logger = {
    // Stryker disable next-line ArrowFunction,BooleanLiteral: equivalent, as the debug lines it guards go nowhere
    isDebugEnabled: () => false,
    debug: () => undefined,
    info: () => undefined,
    warn: (message: string) => warnings.push(message),
  };
  const instrumenter: unknown = Reflect.construct(Instrumenter, [logger]);
  const instrumentMethod = muirMoiraMutatorsFieldOf(instrumenter, 'instrument');

  if (typeof instrumentMethod !== 'function') {
    // Stryker disable next-line StringLiteral: only another StrykerJS version can change the instrumenter's shape
    throw new Error('the Stryker instrumenter has no instrument method');
  }

  const result: unknown = await Reflect.apply(instrumentMethod, instrumenter, [
    [{ name: fileName, content, mutate: true }],
    // Stryker disable next-line ArrayDeclaration: equivalent, as a name no mutator has excludes nothing
    { plugins: null, excludedMutations: [], ignorers },
  ]);
  const files = muirMoiraMutatorsFieldOf(result, 'files');
  const mutants = muirMoiraMutatorsFieldOf(result, 'mutants');
  const code = Array.isArray(files)
    ? muirMoiraMutatorsFieldOf(files[0], 'content')
    : undefined;

  if (typeof code !== 'string' || !Array.isArray(mutants)) {
    // Stryker disable next-line StringLiteral: only another StrykerJS version can change the instrumenter's shape
    throw new Error('Instrumenter.instrument() gave no files or mutants');
  }

  return {
    code,
    warnings,
    mutants: mutants.map((mutant: unknown) => {
      const mutatorName = muirMoiraMutatorsFieldOf(mutant, 'mutatorName');
      const location = muirMoiraMutatorsFieldOf(mutant, 'location');
      const start = schemaPosition(muirMoiraMutatorsFieldOf(location, 'start'));
      const end = schemaPosition(muirMoiraMutatorsFieldOf(location, 'end'));
      const replacement = muirMoiraMutatorsFieldOf(mutant, 'replacement');
      const statusReason = muirMoiraMutatorsFieldOf(mutant, 'statusReason');

      if (
        typeof mutatorName !== 'string' ||
        start === undefined ||
        end === undefined ||
        typeof replacement !== 'string'
      ) {
        throw new Error(
          // Stryker disable next-line StringLiteral: only another StrykerJS version can change the instrumenter's shape
          'Instrumenter.instrument() gave a mutant of an unknown shape',
        );
      }

      return {
        mutatorName,
        line: start.line,
        location: { start, end },
        replacement,
        ignoreReason:
          muirMoiraMutatorsFieldOf(mutant, 'status') === 'Ignored' &&
          typeof statusReason === 'string'
            ? statusReason
            : undefined,
      };
    }),
  };
}

/** StrykerJS 10.1.1 `objectUtils.toSchemaPosition`: its 0-based position, 1-based as in the report. */
function schemaPosition(position: unknown): schema.Position | undefined {
  const line = muirMoiraMutatorsFieldOf(position, 'line');
  const column = muirMoiraMutatorsFieldOf(position, 'column');

  return typeof line === 'number' && typeof column === 'number'
    ? { line: line + 1, column: column + 1 }
    : undefined;
}
