import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Ignorer } from '@stryker-mutator/api/ignore';

import {
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsIsRecord,
} from './is-record.ts';

const coreBin = /[\\/]@stryker-mutator[\\/]core[\\/]bin[\\/]stryker\.js$/;
const nothing = (): undefined => undefined;
const silentLogger = {
  debug: nothing,
  info: nothing,
  warn: nothing,
  error: nothing,
  trace: nothing,
  fatal: nothing,
  isDebugEnabled: () => false,
  isTraceEnabled: () => false,
};

export interface MuirMoiraMutatorsSourceFile {
  readonly name: string;
  readonly content: string;
}

export interface MuirMoiraMutatorsMutantOrigin {
  readonly fileName: string;
  readonly mutatorName: string;
}

export interface MuirMoiraMutatorsListedMutator {
  readonly name: string;
  readonly mutate: (...args: readonly never[]) => unknown;
}

export interface MuirMoiraMutatorsMutatorList
  extends ReadonlyArray<MuirMoiraMutatorsListedMutator> {
  push(...mutators: MuirMoiraMutatorsListedMutator[]): number;
  splice(
    start: number,
    deleteCount: number,
    ...mutators: MuirMoiraMutatorsListedMutator[]
  ): MuirMoiraMutatorsListedMutator[];
}

/** Babel's `NodePath` and `types.Node` in the instrumenter; this package does not depend on Babel. */
export interface MuirMoiraMutatorsExpressionPlacerMethods {
  canPlace(path: unknown): boolean;
  place(path: unknown, appliedMutants: Map<unknown, unknown>): void;
}

export interface MuirMoiraMutatorsInstrumenter<TTypes> {
  readonly dir: string;
  readonly version: string;
  readonly types: TTypes;
  /** The array `transformBabel` reads by default on every file (`babel-transformer.js:8`). */
  readonly allMutators: MuirMoiraMutatorsMutatorList;
  instrument(
    files: readonly MuirMoiraMutatorsSourceFile[],
  ): Promise<readonly MuirMoiraMutatorsMutantOrigin[]>;
}

/**
 * `target` is the first entry of the frozen `allMutantPlacers`; the array is frozen, this object is not
 * (`mutant-placers/index.js:6`).
 */
export interface MuirMoiraMutatorsExpressionPlacer {
  readonly target: object;
  readonly original: MuirMoiraMutatorsExpressionPlacerMethods;
}

export type MuirMoiraMutatorsAssertTypes<TTypes> = (
  value: unknown,
  missing: (name: string) => Error,
) => asserts value is TTypes;

export function muirMoiraMutatorsCorePackageJson(
  argv1: string | undefined = process.argv[1],
  realpath: (path: string) => string = realpathSync,
  resolveHere: (specifier: string) => string = createRequire(import.meta.url)
    .resolve,
): string {
  let bin: string | undefined;

  try {
    bin = argv1 === undefined ? undefined : realpath(argv1);
  } catch {
    // argv1 names no file on disk; fall back to the core this module resolves.
  }

  return bin !== undefined && coreBin.test(bin)
    ? join(bin, '..', '..', 'package.json')
    : resolveHere('@stryker-mutator/core/package.json');
}

/** `packageName` starts every error message, so the user sees which mutator package failed. */
export async function muirMoiraMutatorsResolveInstrumenter<TTypes>(
  packageName: string,
  assertTypes: MuirMoiraMutatorsAssertTypes<TTypes>,
  corePackage: string,
): Promise<MuirMoiraMutatorsInstrumenter<TTypes>> {
  const fromCore = createRequire(corePackage);
  const packageJson = fromCore.resolve(
    '@stryker-mutator/instrumenter/package.json',
  );
  const dir = dirname(packageJson);
  const manifest: unknown = fromCore(packageJson);
  const version = String(muirMoiraMutatorsFieldOf(manifest, 'version'));
  const [mutate, babel] = await Promise.all([
    importFile(join(dir, 'dist', 'src', 'mutators', 'mutate.js')),
    importFile(createRequire(packageJson).resolve('@babel/core')),
  ]);
  const allMutators = muirMoiraMutatorsFieldOf(mutate, 'allMutators');
  const types = muirMoiraMutatorsFieldOf(babel, 'types');
  const missing = hasNo({ packageName, dir, version });

  if (!Array.isArray(allMutators) || !allMutators.every(isListedMutator)) {
    throw missing('allMutators');
  }

  const instrument = await muirMoiraMutatorsCoreInstrument({
    packageName,
    dir,
    version,
  });

  assertTypes(types, missing);

  return {
    dir,
    version,
    types,
    allMutators,
    async instrument(files) {
      const mutants = muirMoiraMutatorsFieldOf(
        await instrument(files),
        'mutants',
      );

      if (!Array.isArray(mutants) || !mutants.every(isMutantOrigin)) {
        throw new Error(
          `${packageName}: the instrumenter ${version} in ${dir} resolved Instrumenter.instrument() to a ` +
            'value whose mutants are missing or have no string fileName and mutatorName.',
        );
      }

      return mutants.map(({ fileName, mutatorName }) => ({
        fileName,
        mutatorName,
      }));
    },
  };
}

/** The instrumenter's `expressionMutantPlacer`, for the packages that patch it. */
export async function muirMoiraMutatorsResolveExpressionPlacer(
  packageName: string,
  { dir, version }: Pick<MuirMoiraMutatorsLocated, 'dir' | 'version'>,
): Promise<MuirMoiraMutatorsExpressionPlacer> {
  const placers = await importFile(
    join(dir, 'dist', 'src', 'mutant-placers', 'index.js'),
  );
  const allMutantPlacers = muirMoiraMutatorsFieldOf(
    placers,
    'allMutantPlacers',
  );
  const missing = hasNo({ packageName, dir, version });

  if (!Array.isArray(allMutantPlacers)) {
    throw missing('allMutantPlacers');
  }

  const placer = allMutantPlacers
    .filter(muirMoiraMutatorsIsRecord)
    .find(({ name }) => name === 'expressionMutantPlacer');

  if (
    placer === undefined ||
    typeof placer['canPlace'] !== 'function' ||
    typeof placer['place'] !== 'function'
  ) {
    throw missing('expressionMutantPlacer');
  }

  const { canPlace, place } = placer;

  return {
    target: placer,
    original: {
      canPlace(path) {
        const placeable: unknown = Reflect.apply(canPlace, placer, [path]);

        if (typeof placeable !== 'boolean') {
          throw new Error(
            `${packageName}: the instrumenter ${version} in ${dir} has an expressionMutantPlacer whose ` +
              `canPlace returned a ${typeof placeable}, not a boolean.`,
          );
        }

        return placeable;
      },
      place(path, appliedMutants) {
        Reflect.apply(place, placer, [path, appliedMutants]);
      },
    },
  };
}

/** What an error message says: the mutator package, and the instrumenter in use. */
export interface MuirMoiraMutatorsLocated {
  readonly packageName: string;
  readonly dir: string;
  readonly version: string;
}

function hasNo({
  packageName,
  dir,
  version,
}: MuirMoiraMutatorsLocated): (name: string) => Error {
  return (name) =>
    new Error(
      `${packageName}: the instrumenter ${version} in ${dir} has no ${name}.`,
    );
}

export async function muirMoiraMutatorsCoreInstrument(
  instrumenter: MuirMoiraMutatorsLocated,
): Promise<
  (
    files: readonly MuirMoiraMutatorsSourceFile[],
    excludedMutations?: readonly string[],
    ignorers?: readonly Ignorer[],
  ) => Promise<unknown>
> {
  const Instrumenter = muirMoiraMutatorsFieldOf(
    await importFile(join(instrumenter.dir, 'dist', 'src', 'index.js')),
    'Instrumenter',
  );
  const instrument =
    typeof Instrumenter === 'function'
      ? muirMoiraMutatorsFieldOf(Instrumenter.prototype, 'instrument')
      : undefined;

  if (typeof Instrumenter !== 'function' || typeof instrument !== 'function') {
    throw hasNo(instrumenter)('Instrumenter');
  }

  return async (files, excludedMutations = [], ignorers = []) => {
    const result: unknown = await Reflect.apply(
      instrument,
      Reflect.construct(Instrumenter, [silentLogger]),
      [
        files.map((file) => ({ ...file, mutate: true })),
        { plugins: null, excludedMutations, ignorers },
      ],
    );

    return result;
  };
}

function isMutantOrigin(
  value: unknown,
): value is MuirMoiraMutatorsMutantOrigin {
  return (
    typeof muirMoiraMutatorsFieldOf(value, 'fileName') === 'string' &&
    typeof muirMoiraMutatorsFieldOf(value, 'mutatorName') === 'string'
  );
}

/** Imports by path: the instrumenter's exports map exposes only `.` and `./package.json`, not its dist files. */
function importFile(path: string): Promise<unknown> {
  return import(pathToFileURL(path).href);
}

function isListedMutator(
  value: unknown,
): value is MuirMoiraMutatorsListedMutator {
  return (
    muirMoiraMutatorsIsRecord(value) &&
    typeof value['name'] === 'string' &&
    typeof value['mutate'] === 'function'
  );
}
