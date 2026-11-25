// The one module that reaches into Stryker's internals: no other module of this package names a file of
// @stryker-mutator/instrumenter's dist, which its exports map leaves out.
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Location, Mutant, Position } from '@stryker-mutator/api/core';

import {
  muirMoiraNodeTestHasMember,
  muirMoiraNodeTestIsFunction,
  muirMoiraNodeTestIsNumber,
  muirMoiraNodeTestIsObject,
  muirMoiraNodeTestIsString,
  muirMoiraNodeTestMember,
} from './guards.ts';
import {
  muirMoiraNodeTestMutatorBuilders,
  type MuirMoiraNodeTestBabelTypes,
} from './mutator.ts';

const coreBinPattern =
  /[\\/]@stryker-mutator[\\/]core[\\/]bin[\\/]stryker\.js$/;
const nothing = () => undefined;
const silent = {
  debug: nothing,
  info: nothing,
  warn: nothing,
  isDebugEnabled: nothing,
};

export interface MuirMoiraNodeTestSourceFile {
  readonly name: string;
  readonly content: string;
}

export type MuirMoiraNodeTestInstrumentedMutant = Pick<
  Mutant,
  'mutatorName' | 'replacement' | 'location'
>;

/** A mutator of the instrumenter's list, Stryker's or this module's, as far as this module checks it. */
export interface MuirMoiraNodeTestListedMutator {
  readonly name: string;
  readonly mutate: (...args: never) => unknown;
}

export interface MuirMoiraNodeTestInstrumenter {
  readonly dir: string;
  readonly version: string;
  /** The list that the instrumenter reads its mutators from each time it transforms a file. */
  readonly allMutators: readonly MuirMoiraNodeTestListedMutator[];
  /** Replaces the contents of `allMutators`, in place, so the instrumenter reads the new list. */
  setMutators(mutators: readonly MuirMoiraNodeTestListedMutator[]): void;
  /** The Babel types of the instrumenter's own @babel/core, to build the nodes it places. */
  readonly types: MuirMoiraNodeTestBabelTypes;
  instrument(
    files: readonly MuirMoiraNodeTestSourceFile[],
    mutators?: readonly MuirMoiraNodeTestListedMutator[],
  ): Promise<readonly MuirMoiraNodeTestInstrumentedMutant[]>;
}

export function muirMoiraNodeTestResolveEachCore(): Promise<
  readonly MuirMoiraNodeTestInstrumenter[]
> {
  return Promise.all(
    muirMoiraNodeTestCorePackageJsons().map((corePackage) =>
      muirMoiraNodeTestResolveFromCore(corePackage),
    ),
  );
}

/**
 * The package.json of each copy of @stryker-mutator/core that may run this process: from the script that started it
 * when that is core's bin, as when Stryker runs from a global install; otherwise, as when a program uses Stryker's API,
 * the core that this module resolves, in the drive-letter case of that program's script and in this module's own.
 */
export function muirMoiraNodeTestCorePackageJsons(
  argv: readonly string[] = process.argv,
  realpath: (path: string) => string = realpathSync,
  resolveHere: (specifier: string) => string = createRequire(import.meta.url)
    .resolve,
): readonly [string, ...string[]] {
  const [, script] = argv;
  const real = realScript(script, realpath);

  if (real !== undefined && coreBinPattern.test(real)) {
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

/**
 * `load` imports a file of the instrumenter or of its @babel/core. The instrumenter exports only its index, so these
 * modules have no importable types, and their members are checked before use.
 */
export async function muirMoiraNodeTestResolveFromCore(
  corePackage: string = muirMoiraNodeTestCorePackageJsons()[0],
  load: (path: string) => Promise<unknown> = importFile,
): Promise<MuirMoiraNodeTestInstrumenter> {
  const fromCore = createRequire(corePackage);
  const packageJson = fromCore.resolve(
    '@stryker-mutator/instrumenter/package.json',
  );
  const dir = dirname(packageJson);
  const mutateFile = join(dir, 'dist', 'src', 'mutators', 'mutate.js');
  const transformerFile = join(
    dir,
    'dist',
    'src',
    'transformers',
    'babel-transformer.js',
  );
  const indexFile = fromCore.resolve('@stryker-mutator/instrumenter');
  const babelFile = createRequire(packageJson).resolve('@babel/core');
  const [mutate, transformer, index, babel] = await Promise.all(
    [mutateFile, transformerFile, indexFile, babelFile].map(load),
  );
  const transformBabel = muirMoiraNodeTestMember(
    transformer,
    'transformBabel',
    muirMoiraNodeTestIsFunction,
    transformerFile,
  );
  const instrumenterClass = muirMoiraNodeTestMember(
    index,
    'Instrumenter',
    muirMoiraNodeTestIsFunction,
    indexFile,
  );
  const allMutators = muirMoiraNodeTestMember(
    mutate,
    'allMutators',
    isMutatorList,
    mutateFile,
  );

  return {
    dir,
    version: muirMoiraNodeTestMember(
      fromCore(packageJson),
      'version',
      muirMoiraNodeTestIsString,
      packageJson,
    ),
    allMutators,
    setMutators(mutators) {
      allMutators.splice(0, allMutators.length, ...mutators);
    },
    types: muirMoiraNodeTestMember(babel, 'types', isBabelTypes, babelFile),
    async instrument(files, mutators) {
      // The instrumenter takes a transform of its own in place of the one that reads `allMutators`.
      const transform =
        mutators &&
        ((ast: unknown, collector: unknown, context: unknown): unknown =>
          Reflect.apply(transformBabel, undefined, [
            ast,
            collector,
            context,
            mutators,
          ]));
      const instance: unknown = Reflect.construct(instrumenterClass, [
        silent,
        undefined,
        undefined,
        transform,
      ]);
      const instrument = muirMoiraNodeTestMember(
        instance,
        'instrument',
        muirMoiraNodeTestIsFunction,
        `the Instrumenter of ${indexFile}`,
      );
      const result: unknown = await Reflect.apply(instrument, instance, [
        files.map((file) => ({ ...file, mutate: true })),
        {
          plugins: null,
          // Stryker disable next-line ArrayDeclaration: equivalent, as no mutator is named "Stryker was here"
          excludedMutations: [],
          ignorers: [],
        },
      ]);

      return muirMoiraNodeTestMember(
        result,
        'mutants',
        isMutantList,
        `the instrument() result of the Instrumenter of ${indexFile}`,
      );
    },
  };
}

function importFile(path: string): Promise<unknown> {
  return import(pathToFileURL(path).href);
}

function isMutatorList(
  value: unknown,
): value is MuirMoiraNodeTestListedMutator[] {
  return Array.isArray(value) && value.every(isListedMutator);
}

function isListedMutator(
  value: unknown,
): value is MuirMoiraNodeTestListedMutator {
  return (
    muirMoiraNodeTestHasMember(value, 'name', muirMoiraNodeTestIsString) &&
    muirMoiraNodeTestHasMember(value, 'mutate', muirMoiraNodeTestIsFunction)
  );
}

/**
 * Has a function for each member of the Babel types that the mutators may call. The other members can differ, as when
 * the consumer's @babel/core is a newer patch than the instrumenter's.
 */
function isBabelTypes(value: unknown): value is MuirMoiraNodeTestBabelTypes {
  return (
    muirMoiraNodeTestIsObject(value) &&
    muirMoiraNodeTestMutatorBuilders.every((key) =>
      muirMoiraNodeTestIsFunction(Reflect.get(value, key)),
    )
  );
}

function isMutantList(
  value: unknown,
): value is MuirMoiraNodeTestInstrumentedMutant[] {
  return Array.isArray(value) && value.every(isMutant);
}

function isMutant(
  value: unknown,
): value is MuirMoiraNodeTestInstrumentedMutant {
  return (
    muirMoiraNodeTestHasMember(
      value,
      'mutatorName',
      muirMoiraNodeTestIsString,
    ) &&
    muirMoiraNodeTestHasMember(
      value,
      'replacement',
      muirMoiraNodeTestIsString,
    ) &&
    muirMoiraNodeTestHasMember(value, 'location', isLocation)
  );
}

function isLocation(value: unknown): value is Location {
  return (
    muirMoiraNodeTestHasMember(value, 'start', isPosition) &&
    muirMoiraNodeTestHasMember(value, 'end', isPosition)
  );
}

function isPosition(value: unknown): value is Position {
  return (
    muirMoiraNodeTestHasMember(value, 'line', muirMoiraNodeTestIsNumber) &&
    muirMoiraNodeTestHasMember(value, 'column', muirMoiraNodeTestIsNumber)
  );
}
