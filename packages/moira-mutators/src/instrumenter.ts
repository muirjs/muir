// The one module that reaches into Stryker's internals: no other module of this package names a file of
// @stryker-mutator/instrumenter's dist, which its exports map leaves out.
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

export interface MuirMoiraMutatorsPosition {
  readonly line: number;
  readonly column: number;
}

export interface MuirMoiraMutatorsMutant {
  readonly fileName: string;
  readonly mutatorName: string;
  readonly replacement: string;
  readonly location: {
    readonly start: MuirMoiraMutatorsPosition;
    readonly end: MuirMoiraMutatorsPosition;
  };
}

/** What the install's checks read of a mutant. */
export type MuirMoiraMutatorsMutantOrigin = Pick<
  MuirMoiraMutatorsMutant,
  'fileName' | 'mutatorName'
>;

/** An instrumenter as the install's checks use it. */
export interface MuirMoiraMutatorsCheckedInstrumenter {
  readonly dir: string;
  readonly version: string;
  instrument(
    files: readonly MuirMoiraMutatorsSourceFile[],
  ): Promise<readonly MuirMoiraMutatorsMutantOrigin[]>;
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
  /** With `mutators`, the instrumenter reads them in place of `allMutators`. */
  instrument(
    files: readonly MuirMoiraMutatorsSourceFile[],
    mutators?: readonly MuirMoiraMutatorsListedMutator[],
  ): Promise<readonly MuirMoiraMutatorsMutant[]>;
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

/** Imports a file of the instrumenter or of its @babel/core. */
export type MuirMoiraMutatorsLoad = (path: string) => Promise<unknown>;

/**
 * The package.json of each copy of @stryker-mutator/core that may run this process: from the script that started it
 * when that is core's bin, as when Stryker runs from a global install; otherwise, as when a program uses Stryker's API,
 * the core that this module resolves, in the drive-letter case of that program's script and in this module's own.
 */
export function muirMoiraMutatorsCorePackageJsons(
  argv: readonly string[] = process.argv,
  realpath: (path: string) => string = realpathSync,
  resolveHere: (specifier: string) => string = createRequire(import.meta.url)
    .resolve,
): readonly [string, ...string[]] {
  const [, script] = argv;
  const real = realScript(script, realpath);

  if (real !== undefined && coreBin.test(real)) {
    return [join(real, '..', '..', 'package.json')];
  }

  const here = resolveHere('@stryker-mutator/core/package.json');
  const scriptCase = real === undefined ? here : withDriveLetterOf(real, here);

  return scriptCase === here ? [here] : [scriptCase, here];
}

function realScript(
  script: string | undefined,
  realpath: (path: string) => string,
): string | undefined {
  // `node --eval` and the REPL run no script file.
  if (script === undefined) {
    return undefined;
  }

  try {
    return realpath(script);
  } catch {
    // What `node --eval` passes on after its code is no script file either.
    return undefined;
  }
}

/**
 * Stryker's modules load with the drive-letter case of the script that started the process when that script imports
 * Stryker, and with the case of the working directory, as this module does, when a runner such as mocha loads the
 * module that imports Stryker. ESM caches modules by URL, which keeps that case, so `d:` and `D:` load two
 * instrumenters, and a self-check of one would pass while Stryker runs the other.
 */
function withDriveLetterOf(script: string, path: string): string {
  const drive = /^[A-Za-z]:/.exec(script)?.[0];

  return drive !== undefined &&
    path.slice(0, 2).toLowerCase() === drive.toLowerCase()
    ? drive + path.slice(2)
    : path;
}

/** The instrumenter of each core in `corePackages`, resolved by `resolveFromCore`. */
export function muirMoiraMutatorsResolveEachCore<TInstrumenter>(
  resolveFromCore: (corePackage: string) => Promise<TInstrumenter>,
  corePackages: readonly string[] = muirMoiraMutatorsCorePackageJsons(),
): Promise<TInstrumenter[]> {
  return Promise.all(
    corePackages.map((corePackage) => resolveFromCore(corePackage)),
  );
}

/** `packageName` starts every error message, so the user sees which mutator package failed. */
export async function muirMoiraMutatorsResolveInstrumenter<TTypes>(
  packageName: string,
  assertTypes: MuirMoiraMutatorsAssertTypes<TTypes>,
  corePackage: string,
  load: MuirMoiraMutatorsLoad = importFile,
): Promise<MuirMoiraMutatorsInstrumenter<TTypes>> {
  const fromCore = createRequire(corePackage);
  const packageJson = fromCore.resolve(
    '@stryker-mutator/instrumenter/package.json',
  );
  const dir = dirname(packageJson);
  const version = muirMoiraMutatorsFieldOf(fromCore(packageJson), 'version');
  const missing = hasNo({ packageName, dir, version: String(version) });

  if (typeof version !== 'string') {
    throw missing('version');
  }

  const [mutate, babel] = await Promise.all([
    load(join(dir, 'dist', 'src', 'mutators', 'mutate.js')),
    load(createRequire(packageJson).resolve('@babel/core')),
  ]);
  const allMutators = muirMoiraMutatorsFieldOf(mutate, 'allMutators');
  const types = muirMoiraMutatorsFieldOf(babel, 'types');

  if (!Array.isArray(allMutators) || !allMutators.every(isListedMutator)) {
    throw missing('allMutators');
  }

  const located = { packageName, dir, version };
  const instrument = await muirMoiraMutatorsCoreInstrument(located, load);

  assertTypes(types, missing);

  return {
    dir,
    version,
    types,
    allMutators,
    async instrument(files, mutators) {
      const mutants = muirMoiraMutatorsFieldOf(
        await instrument(files, [], [], mutators),
        'mutants',
      );

      if (!Array.isArray(mutants) || !mutants.every(isMutant)) {
        throw new Error(
          `${packageName}: the instrumenter ${version} in ${dir} resolved Instrumenter.instrument() to a ` +
            'value whose mutants are missing or lack a string fileName, mutatorName or replacement, or a location.',
        );
      }

      return mutants.map(
        ({ fileName, mutatorName, replacement, location }) => ({
          fileName,
          mutatorName,
          replacement,
          location,
        }),
      );
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

/**
 * The `Instrumenter` of the entry that the instrumenter's package exports, the one Stryker constructs, so that a
 * bundled entry fails the self-check. With `mutators`, it transforms with them in place of `allMutators`.
 */
export async function muirMoiraMutatorsCoreInstrument(
  instrumenter: MuirMoiraMutatorsLocated,
  load: MuirMoiraMutatorsLoad = importFile,
): Promise<
  (
    files: readonly MuirMoiraMutatorsSourceFile[],
    excludedMutations: readonly string[],
    ignorers: readonly Ignorer[],
    mutators?: readonly MuirMoiraMutatorsListedMutator[],
  ) => Promise<unknown>
> {
  const { dir } = instrumenter;
  const missing = hasNo(instrumenter);
  const [index, transformer] = await Promise.all([
    load(
      createRequire(join(dir, 'package.json')).resolve(
        '@stryker-mutator/instrumenter',
      ),
    ),
    load(join(dir, 'dist', 'src', 'transformers', 'babel-transformer.js')),
  ]);
  const Instrumenter = muirMoiraMutatorsFieldOf(index, 'Instrumenter');
  const instrument =
    typeof Instrumenter === 'function'
      ? muirMoiraMutatorsFieldOf(Instrumenter.prototype, 'instrument')
      : undefined;
  const transformBabel = muirMoiraMutatorsFieldOf(
    transformer,
    'transformBabel',
  );

  if (typeof Instrumenter !== 'function' || typeof instrument !== 'function') {
    throw missing('Instrumenter');
  }

  if (typeof transformBabel !== 'function') {
    throw missing('transformBabel');
  }

  return async (files, excludedMutations, ignorers, mutators) => {
    const transform =
      mutators &&
      ((ast: unknown, collector: unknown, context: unknown): unknown =>
        Reflect.apply(transformBabel, undefined, [
          ast,
          collector,
          context,
          mutators,
        ]));
    const result: unknown = await Reflect.apply(
      instrument,
      Reflect.construct(Instrumenter, [
        silentLogger,
        undefined,
        undefined,
        transform,
      ]),
      [
        files.map((file) => ({ ...file, mutate: true })),
        { plugins: null, excludedMutations, ignorers },
      ],
    );

    return result;
  };
}

function isMutant(value: unknown): value is MuirMoiraMutatorsMutant {
  const location = muirMoiraMutatorsFieldOf(value, 'location');

  return (
    typeof muirMoiraMutatorsFieldOf(value, 'fileName') === 'string' &&
    typeof muirMoiraMutatorsFieldOf(value, 'mutatorName') === 'string' &&
    typeof muirMoiraMutatorsFieldOf(value, 'replacement') === 'string' &&
    isPosition(muirMoiraMutatorsFieldOf(location, 'start')) &&
    isPosition(muirMoiraMutatorsFieldOf(location, 'end'))
  );
}

function isPosition(value: unknown): value is MuirMoiraMutatorsPosition {
  return (
    typeof muirMoiraMutatorsFieldOf(value, 'line') === 'number' &&
    typeof muirMoiraMutatorsFieldOf(value, 'column') === 'number'
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
