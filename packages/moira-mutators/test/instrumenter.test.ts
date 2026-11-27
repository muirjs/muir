// corePackageJsons with injected argv, realpath and resolve; resolveInstrumenter against the installed core, with one
// module replaced, and against a fake core and instrumenter written to a temporary node_modules.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';

import { muirTestEach } from '@muirjs/madrox-node-test';
import {
  muirTempRoot,
  muirWriteTree,
} from '@muirjs/test-util-mutator-packages';

import { muirMoiraMutatorsAssertBabelTypes } from '../src/babel-mutator.ts';
import {
  muirMoiraMutatorsCoreInstrument,
  muirMoiraMutatorsCorePackageJsons,
  muirMoiraMutatorsResolveEachCore,
  muirMoiraMutatorsResolveExpressionPlacer,
  muirMoiraMutatorsResolveInstrumenter,
  type MuirMoiraMutatorsListedMutator,
} from '../src/instrumenter.ts';
import { exported } from './support/exports.ts';

const packageName = '@muirjs/test-mutators';
const sampleLocation = {
  start: { line: 0, column: 0 },
  end: { line: 0, column: 1 },
};

function assertTypes(
  value: unknown,
  missing: (name: string) => Error,
): asserts value is { readonly fake: true } {
  if (Reflect.get(Object(value), 'fake') !== true) {
    throw missing('fake types');
  }
}

async function resolveFromCore(corePackage: string) {
  const instrumenter = await muirMoiraMutatorsResolveInstrumenter(
    packageName,
    assertTypes,
    corePackage,
  );

  return {
    ...instrumenter,
    expressionPlacer: await muirMoiraMutatorsResolveExpressionPlacer(
      packageName,
      instrumenter,
    ),
  };
}

describe('corePackageJsons', () => {
  const globalCore = join(
    '/global',
    'node_modules',
    '@stryker-mutator',
    'core',
  );
  const here = join(
    '/repo',
    'node_modules',
    '@stryker-mutator',
    'core',
    'package.json',
  );

  function coreFor(real: string | undefined) {
    const realpaths: string[] = [];
    const cores = muirMoiraMutatorsCorePackageJsons(
      ['/usr/local/bin/node', '/usr/local/bin/stryker'],
      (path) => {
        realpaths.push(path);

        if (real === undefined) {
          throw new Error(
            `ENOENT: no such file or directory, realpath '${path}'`,
          );
        }

        return real;
      },
      (specifier) => {
        assert.equal(specifier, '@stryker-mutator/core/package.json');

        return here;
      },
    );

    assert.deepEqual(realpaths, ['/usr/local/bin/stryker']);

    return cores;
  }

  it("takes the core whose bin started the process, through the bin's links", () => {
    assert.deepEqual(coreFor(join(globalCore, 'bin', 'stryker.js')), [
      join(globalCore, 'package.json'),
    ]);
  });

  muirTestEach([
    ['another script', join('/repo', 'tools', 'corpus-diff.ts')],
    ['a file next to the bin', join(globalCore, 'bin', 'stryker.js.map')],
    [
      "another package's bin",
      join(
        '/global',
        'node_modules',
        '@stryker-mutator',
        'other',
        'bin',
        'stryker.js',
      ),
    ],
    ['a script that is no file', undefined],
  ])(
    'takes the core this module resolves when the process runs %s',
    (_title, real) => {
      assert.deepEqual(coreFor(real), [here]);
    },
  );

  const upperCore =
    'D:\\repo\\node_modules\\@stryker-mutator\\core\\package.json';
  const lowerCore =
    'd:\\repo\\node_modules\\@stryker-mutator\\core\\package.json';

  muirTestEach([
    [
      'in lower case, and this module in upper case',
      'd:\\repo\\tools\\stryker.mjs',
      upperCore,
      [lowerCore, upperCore],
    ],
    [
      'in upper case, and this module in lower case',
      'D:\\repo\\tools\\stryker.mjs',
      lowerCore,
      [upperCore, lowerCore],
    ],
    [
      'in the case of this module',
      'D:\\repo\\tools\\stryker.mjs',
      upperCore,
      [upperCore],
    ],
    ['of another drive', 'e:\\tools\\stryker.mjs', upperCore, [upperCore]],
    ['of none', '/repo/tools/stryker.mjs', upperCore, [upperCore]],
    [
      'of none, though a later folder is a letter and a colon',
      '/repo/d:/stryker.mjs',
      upperCore,
      [upperCore],
    ],
  ])(
    "takes the core this module resolves in the drive-letter case of the script that started the process, and in its own, when the script's real path has a drive letter %s",
    (_title, script, resolvedCore, expected) => {
      const cores = muirMoiraMutatorsCorePackageJsons(
        ['node', script],
        (path) => path,
        () => resolvedCore,
      );

      assert.deepEqual(cores, expected);
    },
  );

  it('takes the core this module resolves, without a realpath, when the process runs no script, as `node --eval` does', () => {
    const realpaths: string[] = [];
    const cores = muirMoiraMutatorsCorePackageJsons(
      ['/usr/local/bin/node'],
      (path) => {
        realpaths.push(path);

        return join(globalCore, 'bin', 'stryker.js');
      },
      () => here,
    );

    assert.deepEqual([cores, realpaths], [[here], []]);
  });
});

describe('resolveEachCore', () => {
  it('resolves the instrumenter of each core, in order', async () => {
    const resolved = await muirMoiraMutatorsResolveEachCore(
      async (corePackage) => `instrumenter of ${corePackage}`,
      ['a', 'b'],
    );

    assert.deepEqual(resolved, ['instrumenter of a', 'instrumenter of b']);
  });
});

describe('resolveInstrumenter against the installed core', () => {
  const core = muirMoiraMutatorsCorePackageJsons()[0];

  function loadingWith(file: string, replacement: unknown) {
    const replaced: string[] = [];
    const load = async (path: string): Promise<unknown> => {
      if (path.endsWith(file)) {
        replaced.push(path);

        return replacement;
      }

      const module: unknown = await import(pathToFileURL(path).href);

      return module;
    };

    return { load, replaced };
  }

  const resolveWith = (file: string, replacement: unknown) =>
    muirMoiraMutatorsResolveInstrumenter(
      packageName,
      muirMoiraMutatorsAssertBabelTypes,
      core,
      loadingWith(file, replacement).load,
    );

  it("instruments with Stryker's mutators, or with the mutators given in their place", async () => {
    const instrumenter = await muirMoiraMutatorsResolveInstrumenter(
      packageName,
      muirMoiraMutatorsAssertBabelTypes,
      core,
    );
    const files = [{ name: 'sample.ts', content: "f('x');" }];
    const own: MuirMoiraMutatorsListedMutator = {
      name: 'Own',
      *mutate(path: unknown) {
        if (
          Reflect.get(Object(Reflect.get(Object(path), 'node')), 'type') ===
          'StringLiteral'
        ) {
          yield instrumenter.types.stringLiteral('y');
        }
      },
    };

    const mutants = async (mutators?: MuirMoiraMutatorsListedMutator[]) =>
      (await instrumenter.instrument(files, mutators)).map(
        ({ fileName, mutatorName, replacement, location }) => [
          fileName,
          mutatorName,
          replacement,
          location,
        ],
      );
    const at = { start: { line: 0, column: 2 }, end: { line: 0, column: 5 } };

    assert.deepEqual(
      [await mutants(), await mutants([own])],
      [
        [['sample.ts', 'StringLiteral', '""', at]],
        [['sample.ts', 'Own', '"y"', at]],
      ],
    );
  });

  it('instruments a file whose directive names a mutator it does not apply, which Stryker warns about', async () => {
    const instrumenter = await muirMoiraMutatorsResolveInstrumenter(
      packageName,
      muirMoiraMutatorsAssertBabelTypes,
      core,
    );
    const content =
      "// Stryker disable next-line MuirProteusNodeTimerDelay: a directive for another catalogue\nf('x');";

    const mutants = await instrumenter.instrument([
      { name: 'sample.ts', content },
    ]);

    assert.deepEqual(
      mutants.map(({ mutatorName }) => mutatorName),
      ['StringLiteral'],
    );
  });

  const mutateFile = join('mutators', 'mutate.js');
  const babelFile = join('core', 'lib', 'index.js');
  const indexFile = join('dist', 'src', 'index.js');
  const transformerFile = join('transformers', 'babel-transformer.js');

  muirTestEach([
    [
      'allMutators that is no array',
      mutateFile,
      { allMutators: {} },
      'allMutators',
    ],
    [
      'a listed mutator that is null',
      mutateFile,
      { allMutators: [null] },
      'allMutators',
    ],
    [
      'a listed mutator with no name',
      mutateFile,
      { allMutators: [{ mutate: () => [] }] },
      'allMutators',
    ],
    [
      'a listed mutator that is null after one it reads',
      mutateFile,
      { allMutators: [{ name: 'Own', mutate: () => [] }, null] },
      'allMutators',
    ],
    [
      'a listed mutator whose name is no string',
      mutateFile,
      { allMutators: [{ name: 1, mutate: () => [] }] },
      'allMutators',
    ],
    [
      'a listed mutator with no mutate function',
      mutateFile,
      { allMutators: [{ name: 'Own', mutate: 'no' }] },
      'allMutators',
    ],
    [
      'no transformBabel function',
      transformerFile,
      { transformBabel: {} },
      'transformBabel',
    ],
    ['no Instrumenter class', indexFile, { Instrumenter: {} }, 'Instrumenter'],
    [
      'an Instrumenter with no instrument method',
      indexFile,
      {
        Instrumenter: function Instrumenter() {
          return undefined;
        },
      },
      'Instrumenter',
    ],
    [
      'no Babel types',
      babelFile,
      {},
      'Babel types with arrowFunctionExpression',
    ],
  ])('refuses an instrumenter with %s', async (_title, file, module, name) => {
    const { dir, version } = await muirMoiraMutatorsResolveInstrumenter(
      packageName,
      muirMoiraMutatorsAssertBabelTypes,
      core,
    );

    await assert.rejects(resolveWith(file, module), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(
        error.message.startsWith(
          `${packageName}: the instrumenter ${version} in ${dir} has no ${name}`,
        ),
        error.message,
      );

      return true;
    });
  });

  const resolvingTo = (result: unknown) =>
    class {
      instrument() {
        return Promise.resolve(result);
      }
    };
  const located = (mutant: object) => ({
    mutants: [
      {
        fileName: 'sample.ts',
        mutatorName: 'Own',
        replacement: '""',
        location: sampleLocation,
        ...mutant,
      },
    ],
  });

  muirTestEach([
    ['an instrument result of nothing', undefined],
    ['an instrument result of null', null],
    ['mutants that are no array', { mutants: {} }],
    ['a mutant that is null', { mutants: [null] }],
    ['a mutant with no file name', located({ fileName: 1 })],
    ['a mutant with no mutator name', located({ mutatorName: undefined })],
    ['a mutant whose replacement is no string', located({ replacement: 1 })],
    [
      'a mutant with no mutator name after a whole one',
      {
        mutants: [
          ...located({}).mutants,
          {
            fileName: 'sample.ts',
            replacement: '""',
            location: sampleLocation,
          },
        ],
      },
    ],
    ['a mutant with no location', located({ location: undefined })],
    [
      'a mutant with no start',
      located({ location: { end: sampleLocation.end } }),
    ],
    [
      'a mutant with no end',
      located({ location: { start: sampleLocation.start } }),
    ],
    [
      'a mutant with no start line',
      located({ location: { ...sampleLocation, start: { column: 0 } } }),
    ],
    [
      'a mutant with no end column',
      located({ location: { ...sampleLocation, end: { line: 0 } } }),
    ],
  ])('refuses %s', async (_title, result) => {
    const instrumenter = await resolveWith(indexFile, {
      Instrumenter: resolvingTo(result),
    });

    await assert.rejects(
      instrumenter.instrument([{ name: 'sample.ts', content: "f('x');" }]),
      {
        message:
          `${packageName}: the instrumenter ${instrumenter.version} in ${instrumenter.dir} resolved ` +
          'Instrumenter.instrument() to a value whose mutants are missing or lack a string fileName, mutatorName or ' +
          'replacement, or a location.',
      },
    );
  });

  it('gives the file name, mutator name, replacement and location of each mutant, whatever else the result holds', async () => {
    const mutant = {
      fileName: 'sample.ts',
      mutatorName: 'Own',
      replacement: '""',
      location: sampleLocation,
    };
    const instrumenter = await resolveWith(indexFile, {
      Instrumenter: resolvingTo({
        files: [],
        mutants: [{ ...mutant, id: '1', status: 'Pending' }],
      }),
    });

    assert.deepEqual(
      await instrumenter.instrument([{ name: 'sample.ts', content: 'x' }]),
      [mutant],
    );
  });
});

describe('resolveInstrumenter against a fake instrumenter', () => {
  const placersFile = (placers: readonly string[]) =>
    `export const allMutantPlacers = [${placers.join(', ')}];`;
  const placersPath =
    '@stryker-mutator/instrumenter/dist/src/mutant-placers/index.js';
  const indexPath = '@stryker-mutator/instrumenter/dist/src/index.js';
  const bundlePath = '@stryker-mutator/instrumenter/dist/bundle.js';
  const mutatorsPath =
    '@stryker-mutator/instrumenter/dist/src/mutators/mutate.js';
  const transformerPath =
    '@stryker-mutator/instrumenter/dist/src/transformers/babel-transformer.js';
  const babelPath = '@babel/core/index.js';
  const recordingInstrumenter =
    'export const calls = [];\n' +
    'export class Instrumenter {\n' +
    '  constructor(...args) { this.args = args; }\n' +
    '  async instrument(files, options) {\n' +
    '    calls.push({ args: this.args, files, options });\n' +
    '    return { files: [], mutants: [] };\n' +
    '  }\n' +
    '}';

  async function callsOf(modules: string, path: string): Promise<unknown> {
    return exported(
      await import(pathToFileURL(join(modules, path)).href),
      'calls',
    );
  }

  function fakeCore(
    t: TestContext,
    placers: readonly string[],
    replace: Readonly<Record<string, string>> = {},
  ) {
    const modules = join(
      muirTempRoot(t, 'mutator-install-core-'),
      'node_modules',
    );
    const dir = join(modules, '@stryker-mutator', 'instrumenter');
    const files: Record<string, string> = {
      '@stryker-mutator/core/package.json':
        '{ "name": "@stryker-mutator/core", "version": "9.9.9" }',
      '@stryker-mutator/instrumenter/package.json': JSON.stringify({
        name: '@stryker-mutator/instrumenter',
        version: '9.9.8',
        type: 'module',
        exports: {
          '.': './dist/src/index.js',
          './package.json': './package.json',
        },
      }),
      [mutatorsPath]: 'export const allMutators = [];',
      [transformerPath]: 'export function transformBabel() {}',
      [placersPath]: placersFile(
        placers.map(
          (name) =>
            `{ name: ${JSON.stringify(name)}, canPlace() { return false; }, place() {} }`,
        ),
      ),
      [indexPath]: recordingInstrumenter,
      '@babel/core/package.json':
        '{ "name": "@babel/core", "type": "module", "main": "index.js" }',
      [babelPath]: 'export const types = { fake: true };',
      ...replace,
    };

    muirWriteTree(modules, files);

    return {
      corePackage: join(modules, '@stryker-mutator', 'core', 'package.json'),
      dir,
      modules,
    };
  }

  it('resolves an instrumenter without an expressionMutantPlacer, as only some packages patch it', async (t) => {
    const { corePackage } = fakeCore(t, ['otherPlacer']);

    const instrumenter = await muirMoiraMutatorsResolveInstrumenter(
      packageName,
      assertTypes,
      corePackage,
    );

    assert.equal(instrumenter.version, '9.9.8');
  });

  it('throws, naming the version and dir, when the instrumenter has no expressionMutantPlacer', async (t) => {
    const { corePackage, dir } = fakeCore(t, ['otherPlacer']);

    await assert.rejects(resolveFromCore(corePackage), {
      message: `${packageName}: the instrumenter 9.9.8 in ${dir} has no expressionMutantPlacer.`,
    });
  });

  it('throws, naming the dir, when the instrumenter has no string version', async (t) => {
    const { corePackage, dir } = fakeCore(t, ['expressionMutantPlacer'], {
      '@stryker-mutator/instrumenter/package.json': JSON.stringify({
        name: '@stryker-mutator/instrumenter',
        version: 9,
      }),
    });

    await assert.rejects(resolveFromCore(corePackage), {
      message: `${packageName}: the instrumenter 9 in ${dir} has no version.`,
    });
  });

  (
    [
      ['allMutantPlacers', placersPath, 'export const placers = [];'],
      [
        'expressionMutantPlacer',
        placersPath,
        placersFile(["{ name: 'expressionMutantPlacer', place() {} }"]),
      ],
      [
        'expressionMutantPlacer',
        placersPath,
        placersFile(["{ name: 'expressionMutantPlacer', canPlace() {} }"]),
      ],
      ['fake types', babelPath, 'export const types = {};'],
    ] as const
  ).forEach(([missing, file, content]) => {
    it(`throws, naming the version and dir, when the instrumenter has no ${missing} (${content})`, async (t) => {
      const { corePackage, dir } = fakeCore(t, ['expressionMutantPlacer'], {
        [file]: content,
      });

      await assert.rejects(resolveFromCore(corePackage), {
        message: `${packageName}: the instrumenter 9.9.8 in ${dir} has no ${missing}.`,
      });
    });
  });

  it("takes the placer named expressionMutantPlacer, the instrumenter's version and its Babel's types", async (t) => {
    const { corePackage, dir } = fakeCore(t, [
      'otherPlacer',
      'expressionMutantPlacer',
    ]);

    const instrumenter = await resolveFromCore(corePackage);
    const placer: unknown = Reflect.get(
      instrumenter.expressionPlacer.target,
      'name',
    );

    assert.deepEqual(
      {
        dir: instrumenter.dir,
        version: instrumenter.version,
        placer,
      },
      {
        dir,
        version: '9.9.8',
        placer: 'expressionMutantPlacer',
      },
    );
    assert.deepEqual(instrumenter.types, { fake: true });
  });

  it('skips placer entries that are not objects', async (t) => {
    const { corePackage } = fakeCore(t, [], {
      [placersPath]: placersFile([
        'null',
        "'expressionMutantPlacer'",
        "{ name: 'expressionMutantPlacer', canPlace() { return false; }, place() {} }",
      ]),
    });

    const instrumenter = await resolveFromCore(corePackage);

    assert.equal(
      Reflect.get(instrumenter.expressionPlacer.target, 'name'),
      'expressionMutantPlacer',
    );
  });

  it("calls the placer's own canPlace and place on the placer, with the arguments it was given", async (t) => {
    const { corePackage, modules } = fakeCore(t, [], {
      [placersPath]:
        'export const calls = [];\n' +
        'const placer = {\n' +
        "  name: 'expressionMutantPlacer',\n" +
        "  canPlace(...args) { calls.push(['canPlace', this === placer, ...args]); return true; },\n" +
        "  place(...args) { calls.push(['place', this === placer, ...args]); },\n" +
        '};\n' +
        'export const allMutantPlacers = [placer];',
    });
    const { original } = (await resolveFromCore(corePackage)).expressionPlacer;
    const path = { node: 'Program' };
    const applied = new Map<unknown, unknown>();

    const placed = original.canPlace(path);
    original.place(path, applied);

    assert.equal(placed, true);
    assert.deepEqual(await callsOf(modules, placersPath), [
      ['canPlace', true, path],
      ['place', true, path, applied],
    ]);
  });

  it('throws, naming the version and dir, when the placer gives canPlace a value that is not a boolean', async (t) => {
    const { corePackage, dir } = fakeCore(t, [], {
      [placersPath]: placersFile([
        "{ name: 'expressionMutantPlacer', canPlace() { return 1; }, place() {} }",
      ]),
    });
    const { original } = (await resolveFromCore(corePackage)).expressionPlacer;
    const path = { node: 'Program' };

    assert.throws(() => original.canPlace(path), {
      message: `${packageName}: the instrumenter 9.9.8 in ${dir} has an expressionMutantPlacer whose canPlace returned a number, not a boolean.`,
    });
  });

  it('constructs the Instrumenter of the entry that the package exports, as Stryker does', async (t) => {
    const { corePackage, modules } = fakeCore(t, ['expressionMutantPlacer'], {
      '@stryker-mutator/instrumenter/package.json': JSON.stringify({
        name: '@stryker-mutator/instrumenter',
        version: '9.9.8',
        type: 'module',
        exports: {
          '.': './dist/bundle.js',
          './package.json': './package.json',
        },
      }),
      [indexPath]: 'export class Instrumenter {}',
      [bundlePath]: recordingInstrumenter,
    });
    const instrumenter = await resolveFromCore(corePackage);

    await instrumenter.instrument([{ name: 'a.tsx', content: 'x' }]);

    const calls = await callsOf(modules, bundlePath);
    assert.ok(Array.isArray(calls));
    assert.equal(calls.length, 1);
  });

  it('loads the entry of the instrumenter in its dir also when no node_modules holds that dir, as in a linked checkout', async (t) => {
    const dir = join(muirTempRoot(t, 'mutator-linked-'), 'instrumenter');
    muirWriteTree(dir, {
      'package.json': JSON.stringify({
        name: '@stryker-mutator/instrumenter',
        version: '9.9.8',
        type: 'module',
        exports: {
          '.': './dist/src/index.js',
          './package.json': './package.json',
        },
      }),
      'dist/src/index.js': recordingInstrumenter,
      'dist/src/transformers/babel-transformer.js':
        'export function transformBabel() {}',
    });
    const instrument = await muirMoiraMutatorsCoreInstrument({
      packageName,
      dir,
      version: '9.9.8',
    });

    await instrument([{ name: 'a.tsx', content: 'x' }], [], []);

    const calls = await callsOf(dir, 'dist/src/index.js');
    assert.ok(Array.isArray(calls));
    assert.equal(calls.length, 1);
  });

  it('constructs the instrumenter with the logger it is given', async (t) => {
    const { modules } = fakeCore(t, ['expressionMutantPlacer']);
    const dir = join(modules, '@stryker-mutator', 'instrumenter');
    const logger = {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      trace: () => undefined,
      fatal: () => undefined,
      isDebugEnabled: () => false,
      isTraceEnabled: () => false,
      isInfoEnabled: () => false,
      isWarnEnabled: () => false,
      isErrorEnabled: () => false,
      isFatalEnabled: () => false,
    };
    const instrument = await muirMoiraMutatorsCoreInstrument(
      { packageName, dir, version: '9.9.8' },
      undefined,
      logger,
    );

    await instrument([{ name: 'a.tsx', content: 'x' }], [], []);

    const calls = await callsOf(modules, indexPath);
    assert.ok(Array.isArray(calls) && calls.length === 1);
    const call: unknown = calls[0];
    assert.ok(typeof call === 'object' && call !== null);
    const { args }: { args?: unknown } = call;
    assert.ok(Array.isArray(args));
    assert.equal(args[0], logger);
  });

  it('instruments every file with mutate set, no plugins, no ignorers and no exclusions, through a silent logger and the default transform', async (t) => {
    const { corePackage, modules } = fakeCore(t, ['expressionMutantPlacer']);
    const instrumenter = await resolveFromCore(corePackage);

    await instrumenter.instrument([{ name: 'a.tsx', content: 'x' }]);

    const calls = await callsOf(modules, indexPath);
    assert.ok(Array.isArray(calls) && calls.length === 1);
    const call: unknown = calls[0];
    assert.ok(typeof call === 'object' && call !== null);
    const {
      files,
      options,
      args,
    }: { files?: unknown; options?: unknown; args?: unknown } = call;
    assert.ok(Array.isArray(args));
    const argList: readonly unknown[] = args;
    const [logger, ...rest] = argList;
    assert.ok(typeof logger === 'object' && logger !== null);

    assert.deepEqual(files, [{ name: 'a.tsx', content: 'x', mutate: true }]);
    assert.deepEqual(options, {
      plugins: null,
      excludedMutations: [],
      ignorers: [],
    });
    assert.deepEqual(rest, [undefined, undefined, undefined]);
    assert.deepEqual(
      Object.keys(logger).map((name) => {
        const method: unknown = Reflect.get(logger, name);
        const returned: unknown =
          typeof method === 'function'
            ? Reflect.apply(method, undefined, [])
            : method;

        return [name, returned];
      }),
      [
        ['debug', undefined],
        ['info', undefined],
        ['warn', undefined],
        ['error', undefined],
        ['trace', undefined],
        ['fatal', undefined],
        ['isDebugEnabled', false],
        ['isTraceEnabled', false],
        ['isInfoEnabled', false],
        ['isWarnEnabled', false],
        ['isErrorEnabled', false],
        ['isFatalEnabled', false],
      ],
    );
  });

  it('passes the mutators given to transformBabel, after the arguments of the transform', async (t) => {
    const { corePackage, modules } = fakeCore(t, ['expressionMutantPlacer'], {
      [transformerPath]:
        'export const calls = [];\n' +
        'export function transformBabel(...args) { calls.push(args); return "transformed"; }',
      [indexPath]:
        'export const results = [];\n' +
        'export class Instrumenter {\n' +
        '  constructor(logger, a, b, transform) { this.transform = transform; }\n' +
        '  async instrument() {\n' +
        "    results.push(this.transform('ast', 'collector', 'context'));\n" +
        '    return { files: [], mutants: [] };\n' +
        '  }\n' +
        '}',
    });
    const instrumenter = await resolveFromCore(corePackage);
    const mutators: MuirMoiraMutatorsListedMutator[] = [
      { name: 'Own', mutate: () => undefined },
    ];

    await instrumenter.instrument([{ name: 'a.tsx', content: 'x' }], mutators);

    assert.deepEqual(
      [
        await callsOf(modules, transformerPath),
        exported(
          await import(pathToFileURL(join(modules, indexPath)).href),
          'results',
        ),
      ],
      [[['ast', 'collector', 'context', mutators]], ['transformed']],
    );
  });
});
