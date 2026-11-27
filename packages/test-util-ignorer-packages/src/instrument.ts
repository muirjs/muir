import { createRequire } from 'node:module';
import { dirname } from 'node:path';

import {
  muirMoiraMutatorsCoreInstrument,
  muirMoiraMutatorsCorePackageJsons,
  muirMoiraMutatorsFieldOf,
} from '@muirjs/moira-mutators';
import type { schema } from '@stryker-mutator/api/core';
import type { Ignorer } from '@stryker-mutator/api/ignore';
import type { Logger } from '@stryker-mutator/api/logging';

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
  const corePackage = muirMoiraMutatorsCorePackageJsons()[0];
  const packageJson = createRequire(corePackage).resolve(
    '@stryker-mutator/instrumenter/package.json',
  );
  const version: unknown = muirMoiraMutatorsFieldOf(
    createRequire(corePackage)(packageJson),
    // Stryker disable next-line StringLiteral: the version only names the instrumenter in the error for one without an Instrumenter, and the installed one has it
    'version',
  );
  const warnings: string[] = [];
  const instrument = await muirMoiraMutatorsCoreInstrument(
    {
      // Stryker disable next-line StringLiteral: the package name only starts the error for an instrumenter without an Instrumenter, and the installed one has it
      packageName: '@muirjs/test-util-ignorer-packages',
      dir: dirname(packageJson),
      version: String(version),
    },
    undefined,
    warningsLogger(warnings),
  );
  // Stryker disable next-line ArrayDeclaration: equivalent, as a name no mutator has excludes nothing
  const result = await instrument([{ name: fileName, content }], [], ignorers);
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

/** A logger that keeps only the instrumenter's warnings. */
function warningsLogger(warnings: string[]): Logger {
  const ignore = (): undefined => undefined;
  // Stryker disable next-line ArrowFunction,BooleanLiteral: equivalent, as every level but warn goes nowhere
  const disabled = (): boolean => false;

  return {
    trace: ignore,
    debug: ignore,
    info: ignore,
    warn: (message) => {
      warnings.push(message);
    },
    error: ignore,
    fatal: ignore,
    isTraceEnabled: disabled,
    isDebugEnabled: disabled,
    isInfoEnabled: disabled,
    // Stryker disable next-line ArrowFunction,BooleanLiteral: equivalent, as StrykerJS 10.1.1's instrumenter warns without asking
    isWarnEnabled: () => true,
    isErrorEnabled: disabled,
    isFatalEnabled: disabled,
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
