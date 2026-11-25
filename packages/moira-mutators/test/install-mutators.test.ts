import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { muirTestEach } from '@muirjs/madrox-node-test';

import { muirMoiraMutatorsBuiltInNames } from '../src/built-ins.ts';
import {
  muirMoiraMutatorsInstall,
  type MuirMoiraMutatorsPatch,
} from '../src/install-mutators.ts';
import {
  muirMoiraMutatorsMarkOf,
  muirMoiraMutatorsSelfCheckFile,
  type MuirMoiraMutatorsSampledMutator,
} from '../src/install.ts';
import type {
  MuirMoiraMutatorsInstrumenter,
  MuirMoiraMutatorsListedMutator,
  MuirMoiraMutatorsSourceFile,
} from '../src/instrumenter.ts';

const packageName = '@muirjs/sample-mutators';
const otherPackage = '@muirjs/other-mutators';
const sampleLocation = {
  start: { line: 0, column: 0 },
  end: { line: 0, column: 1 },
};

interface Mutator extends MuirMoiraMutatorsSampledMutator {
  readonly mutate: () => undefined;
}

type Instrumenter = MuirMoiraMutatorsInstrumenter<{ readonly fake: true }>;

function mutator(name: string): Mutator {
  return { name, sample: `${name}();`, mutate: () => undefined };
}

/**
 * Each listed built-in makes a mutant in every file, and each other listed mutator not in `silent` one in its own
 * sample file. A `stale` instrumenter also runs the built-ins it started with, as one that reads another list does.
 */
function fakeInstrumenter({
  builtIns = muirMoiraMutatorsBuiltInNames,
  silent = [],
  stale = false,
  version = '10.1.1',
  dir = '/stryker/instrumenter',
}: {
  readonly builtIns?: readonly string[];
  readonly silent?: readonly string[];
  readonly stale?: boolean;
  readonly version?: string;
  readonly dir?: string;
} = {}) {
  const listed = builtIns.map(
    (name): MuirMoiraMutatorsListedMutator => ({
      name,
      mutate: () => undefined,
    }),
  );
  const allMutators: MuirMoiraMutatorsListedMutator[] = [...listed];
  const instrumented: MuirMoiraMutatorsSourceFile[][] = [];
  const instrumenter: Instrumenter = {
    dir,
    version,
    types: { fake: true },
    allMutators,
    async instrument(files) {
      instrumented.push([...files]);

      return files.flatMap(({ name: fileName }) =>
        (stale ? [...listed, ...allMutators] : allMutators)
          .filter(
            ({ name }) =>
              !silent.includes(name) &&
              (muirMoiraMutatorsBuiltInNames.includes(name) ||
                fileName === muirMoiraMutatorsSelfCheckFile(name)),
          )
          .map(({ name }) => ({
            fileName,
            mutatorName: name,
            replacement: '',
            location: sampleLocation,
          })),
      );
    },
  };

  return {
    instrumenter,
    instrumented,
    names: () => allMutators.map(({ name }) => name),
  };
}

function install(
  instrumenters: readonly Instrumenter[],
  mutators: readonly Mutator[],
  {
    removeBuiltIns,
    by = packageName,
    testedVersion = '10.1.1',
    warnings = [],
    patch,
    options,
  }: {
    readonly removeBuiltIns?: boolean;
    readonly by?: string;
    readonly testedVersion?: string;
    readonly warnings?: string[];
    readonly patch?: MuirMoiraMutatorsPatch<Instrumenter>;
    readonly options?: unknown;
  } = {},
) {
  return muirMoiraMutatorsInstall({
    packageName: by,
    installName: 'muirSampleMutators',
    testedVersion,
    ...(removeBuiltIns === undefined ? {} : { removeBuiltIns }),
    sets: { defaults: mutators, optIn: [], experimental: [] },
    options,
    resolve: async () => instrumenters,
    toListed: ({ name, mutate }) => ({ name, mutate }),
    ...(patch === undefined ? {} : { patch }),
    warn: (message) => warnings.push(message),
  });
}

describe('install', () => {
  it("adds the mutators after Stryker's, marked, instruments each one's sample, and resolves to them", async () => {
    const { instrumenter, instrumented, names } = fakeInstrumenter();
    const warnings: string[] = [];
    const mutators = [mutator('Alpha'), mutator('Beta')];

    const installed = await install([instrumenter], mutators, { warnings });

    assert.deepEqual(names(), [
      ...muirMoiraMutatorsBuiltInNames,
      'Alpha',
      'Beta',
    ]);
    assert.deepEqual(
      instrumenter.allMutators.map(
        (listed) => muirMoiraMutatorsMarkOf(packageName) in listed,
      ),
      [...muirMoiraMutatorsBuiltInNames.map(() => false), true, true],
    );
    assert.deepEqual(instrumented, [
      [
        { name: 'Alpha.self-check.tsx', content: 'Alpha();' },
        { name: 'Beta.self-check.tsx', content: 'Beta();' },
      ],
    ]);
    assert.deepEqual([installed, warnings], [mutators, []]);
  });

  it('gives toListed each mutator with the instrumenter it goes into', async () => {
    const first = fakeInstrumenter();
    const second = fakeInstrumenter({ dir: '/stryker/copy' });
    const calls: [string, string][] = [];

    await muirMoiraMutatorsInstall({
      packageName,
      installName: 'muirSampleMutators',
      testedVersion: '10.1.1',
      sets: { defaults: [mutator('Alpha')], optIn: [], experimental: [] },
      options: undefined,
      resolve: async () => [first.instrumenter, second.instrumenter],
      toListed: ({ name, mutate }, { dir }) => {
        calls.push([name, dir]);

        return { name, mutate };
      },
      warn: () => undefined,
    });

    assert.deepEqual(calls, [
      ['Alpha', '/stryker/instrumenter'],
      ['Alpha', '/stryker/copy'],
    ]);
  });

  it('selects by the options, and throws on an option it does not take before it resolves an instrumenter', async () => {
    let resolved = false;
    const install = (options: unknown) =>
      muirMoiraMutatorsInstall({
        packageName,
        installName: 'muirSampleMutators',
        testedVersion: '10.1.1',
        sets: {
          defaults: [mutator('Alpha')],
          optIn: [mutator('Beta')],
          experimental: [],
        },
        options,
        resolve: async () => {
          resolved = true;

          return [fakeInstrumenter().instrumenter];
        },
        toListed: ({ name, mutate }) => ({ name, mutate }),
        warn: () => undefined,
      });

    await assert.rejects(install({ Gamma: true }), {
      message: `${packageName}: no opt-in mutator is named Gamma; the names are Beta.`,
    });
    assert.equal(resolved, false);
    assert.deepEqual(
      (await install({ Beta: true })).map(({ name }) => name),
      ['Alpha', 'Beta'],
    );
  });

  it('installs into each copy of the instrumenter, and on a failed self-check throws naming the copy and gives every list back', async () => {
    const first = fakeInstrumenter();
    const second = fakeInstrumenter({
      silent: ['Alpha'],
      dir: '/stryker/copy',
    });

    await assert.rejects(
      install([first.instrumenter, second.instrumenter], [mutator('Alpha')]),
      {
        message:
          `${packageName}: the instrumenter 10.1.1 in /stryker/copy made no mutants of Alpha from their samples, so it ` +
          'does not run the mutators this module added. A bundled or second copy of the instrumenter does that.',
      },
    );
    assert.deepEqual(
      [first.names(), second.names()],
      [muirMoiraMutatorsBuiltInNames, muirMoiraMutatorsBuiltInNames],
    );
  });

  it('adds nothing twice when it installs the same mutators again, and replaces its own earlier selection', async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await install([instrumenter], [mutator('Alpha'), mutator('Beta')]);
    await install([instrumenter], [mutator('Alpha')]);
    await install([instrumenter], [mutator('Alpha'), mutator('Gamma')]);

    assert.deepEqual(names(), [
      ...muirMoiraMutatorsBuiltInNames,
      'Alpha',
      'Gamma',
    ]);
  });

  it("removes Stryker's mutators, and its own earlier ones, with removeBuiltIns", async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await install([instrumenter], [mutator('Alpha')]);
    await install([instrumenter], [mutator('Beta'), mutator('Gamma')], {
      removeBuiltIns: true,
    });
    await install([instrumenter], [mutator('Beta'), mutator('Gamma')], {
      removeBuiltIns: true,
    });

    assert.deepEqual(names(), ['Beta', 'Gamma']);
  });

  it("keeps the mutators another package installed when it removes Stryker's", async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await install([instrumenter], [mutator('Delta')], { by: otherPackage });
    await install([instrumenter], [mutator('Alpha')]);
    await install([instrumenter], [mutator('Beta')], { removeBuiltIns: true });

    assert.deepEqual(names(), ['Delta', 'Beta']);
  });

  it('throws and gives the list back when a built-in still makes mutants after it removed them, as a second instrumenter does', async () => {
    const { instrumenter, names } = fakeInstrumenter({ stale: true });

    await assert.rejects(
      install([instrumenter], [mutator('Alpha')], { removeBuiltIns: true }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(
          error.message,
          /^@muirjs\/sample-mutators: the instrumenter 10\.1\.1 in \/stryker\/instrumenter still made mutants of the built-ins ArithmeticOperator, /,
        );

        return true;
      },
    );
    assert.deepEqual(names(), muirMoiraMutatorsBuiltInNames);
  });

  it('keeps the built-ins without removeBuiltIns, and checks none of them', async () => {
    const { instrumenter, instrumented } = fakeInstrumenter({ stale: true });

    await install([instrumenter], [mutator('Alpha')]);

    assert.deepEqual(
      instrumented.map((files) => files.map(({ name }) => name)),
      [['Alpha.self-check.tsx']],
    );
  });

  it('refuses a name that another package installed, ignoring case', async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await install([instrumenter], [mutator('Delta')], { by: otherPackage });

    await assert.rejects(install([instrumenter], [mutator('DELTA')]), {
      message: `${packageName}: another mutator already has the name DELTA.`,
    });
    assert.deepEqual(names(), [...muirMoiraMutatorsBuiltInNames, 'Delta']);
  });

  it('checks the names in each copy before it changes any', async () => {
    const first = fakeInstrumenter();
    const second = fakeInstrumenter({ builtIns: ['Alpha'] });

    await assert.rejects(
      install([first.instrumenter, second.instrumenter], [mutator('Alpha')]),
      {
        message: `${packageName}: another mutator already has the name Alpha.`,
      },
    );
    assert.deepEqual(
      [first.names(), first.instrumented, second.names()],
      [muirMoiraMutatorsBuiltInNames, [], ['Alpha']],
    );
  });

  const refusals: readonly (readonly [
    string,
    boolean,
    readonly Mutator[],
    string,
  ])[] = [
    ["a name of Stryker's", false, [mutator('StringLiteral')], 'StringLiteral'],
    [
      "a name of Stryker's, also when it removes them",
      true,
      [mutator('StringLiteral')],
      'StringLiteral',
    ],
    [
      "a name of Stryker's in another case",
      false,
      [mutator('Stringliteral')],
      'Stringliteral',
    ],
    [
      "two names of Stryker's",
      false,
      [mutator('CallExpression'), mutator('StringLiteral')],
      'CallExpression, StringLiteral',
    ],
    [
      'a name twice',
      false,
      [mutator('Alpha'), mutator('Beta'), mutator('Alpha')],
      'Alpha',
    ],
    [
      'a name twice in another case',
      false,
      [mutator('Alpha'), mutator('ALPHA')],
      'ALPHA',
    ],
  ];

  muirTestEach(refusals)(
    'refuses %s before it changes the list',
    async (_title, removeBuiltIns, mutators, name) => {
      const { instrumenter, names, instrumented } = fakeInstrumenter();

      await assert.rejects(
        install([instrumenter], mutators, { removeBuiltIns }),
        {
          message: `${packageName}: another mutator already has the name ${name}.`,
        },
      );
      assert.deepEqual(
        [names(), instrumented],
        [muirMoiraMutatorsBuiltInNames, []],
      );
    },
  );

  muirTestEach(['NodeTimer1', 'Node-Timer', 'Node_Timer', 'Node Timer', ''])(
    'refuses the name %j, as a name has letters only',
    async (name) => {
      const { instrumenter, names } = fakeInstrumenter();

      await assert.rejects(
        install([instrumenter], [mutator('Alpha'), mutator(name)]),
        {
          message:
            `${packageName}: a mutator name has letters only, as Stryker's directives match no other ` +
            `character: ${JSON.stringify(name)}`,
        },
      );
      assert.deepEqual(names(), muirMoiraMutatorsBuiltInNames);
    },
  );

  it('applies the patch to each instrumenter, and gives its targets back when a check fails', async () => {
    const targets = [{ patched: false }, { patched: false }];
    const instrumenters = [
      fakeInstrumenter().instrumenter,
      fakeInstrumenter({ silent: ['Alpha'], dir: '/stryker/copy' })
        .instrumenter,
    ];
    const patch: MuirMoiraMutatorsPatch<Instrumenter> = {
      targets: (instrumenter) => [
        targets[instrumenters.indexOf(instrumenter)] ?? {},
      ],
      apply: (instrumenter) => {
        Object.assign(targets[instrumenters.indexOf(instrumenter)] ?? {}, {
          patched: true,
        });
      },
    };
    const patched: boolean[] = [];

    await assert.rejects(
      install(instrumenters, [mutator('Alpha')], {
        patch: {
          ...patch,
          apply: (instrumenter) => {
            patch.apply(instrumenter);
            patched.push(...targets.map((target) => target.patched));
          },
        },
      }),
    );
    assert.deepEqual(
      [patched, targets],
      [
        [true, false, true, true],
        [{ patched: false }, { patched: false }],
      ],
    );
  });

  it('keeps the patch when every check passes', async () => {
    const target = { patched: false };

    await install([fakeInstrumenter().instrumenter], [mutator('Alpha')], {
      patch: {
        targets: () => [target],
        apply: () => {
          target.patched = true;
        },
      },
    });

    assert.deepEqual(target, { patched: true });
  });

  it('warns once for each instrumenter version it was not tested with, after the checks passed', async () => {
    const warnings: string[] = [];

    await install(
      [
        fakeInstrumenter({ version: '10.2.0', dir: '/a' }).instrumenter,
        fakeInstrumenter({ version: '10.2.0', dir: '/b' }).instrumenter,
        fakeInstrumenter({ version: '10.1.1', dir: '/c' }).instrumenter,
        fakeInstrumenter({ version: '11.0.0', dir: '/d' }).instrumenter,
      ],
      [mutator('Alpha')],
      { warnings },
    );

    assert.deepEqual(warnings, [
      `${packageName} was tested with @stryker-mutator/instrumenter 10.1.1, not 10.2.0 in /b; its self-check passed.`,
      `${packageName} was tested with @stryker-mutator/instrumenter 10.1.1, not 11.0.0 in /d; its self-check passed.`,
    ]);
  });

  it('warns about nothing when the self-check fails', async () => {
    const warnings: string[] = [];

    await assert.rejects(
      install(
        [
          fakeInstrumenter({ version: '10.2.0', silent: ['Alpha'] })
            .instrumenter,
        ],
        [mutator('Alpha')],
        { warnings },
      ),
    );

    assert.deepEqual(warnings, []);
  });
});
