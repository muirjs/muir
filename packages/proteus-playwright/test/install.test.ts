import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  muirMoiraMutatorsBuiltInNames,
  muirMoiraMutatorsMarkOf,
} from '@muirjs/moira-mutators';

import {
  muirProteusPlaywrightAssertBabelTypes,
  muirProteusPlaywrightInstall,
} from '../src/install.ts';
import { defined } from './support/defined.ts';
import { programOf } from './support/parse.ts';
import {
  fakeInstrumenter,
  fakeTypes,
  ownMark,
  sets,
} from './support/fake-instrumenter.ts';

describe('assertBabelTypes', () => {
  const missing = (name: string) => new Error(`no ${name}`);

  it('accepts an object with the members the mutators call', () => {
    assert.doesNotThrow(() =>
      muirProteusPlaywrightAssertBabelTypes(fakeTypes, missing),
    );
  });

  it('names the members an object lacks, through the missing-member error', () => {
    assert.throws(
      () =>
        muirProteusPlaywrightAssertBabelTypes(
          { ...fakeTypes, emptyStatement: 1 },
          missing,
        ),
      { message: 'no Babel types with emptyStatement' },
    );
  });

  it('lists every member an object lacks, comma-separated', () => {
    assert.throws(
      () =>
        muirProteusPlaywrightAssertBabelTypes(
          { ...fakeTypes, emptyStatement: 1, identifier: undefined },
          missing,
        ),
      { message: 'no Babel types with emptyStatement, identifier' },
    );
  });

  it('rejects a value that is no object, through the missing-member error', () => {
    for (const value of [undefined, null, 'types']) {
      assert.throws(
        () => muirProteusPlaywrightAssertBabelTypes(value, missing),
        {
          message: 'no Babel types',
        },
      );
    }
  });
});

function programPath(filename: unknown, program: unknown = emptyProgram) {
  return {
    node: program,
    hub: { file: { opts: { filename } } },
  };
}

const emptyProgram = { type: 'Program', body: [] };

async function installedMutate(warn: (message: string) => void) {
  const { instrumenter } = fakeInstrumenter();

  await muirProteusPlaywrightInstall(
    sets(['MuirProteusPlaywrightOne', 'MuirProteusPlaywrightTwo']),
    undefined,
    async () => [instrumenter],
    warn,
    () => undefined,
  );

  return (name: string, path: unknown): unknown =>
    Reflect.apply(
      defined(instrumenter.allMutators.find((listed) => listed.name === name))
        .mutate,
      undefined,
      [path],
    );
}

describe('the warning for a file that is not Playwright test code', () => {
  it('names the file and the turned-off built-ins when a Program node has no @playwright/ import and no top-level test call', async () => {
    const warnings: string[] = [];
    const mutate = await installedMutate((message) => warnings.push(message));

    mutate('MuirProteusPlaywrightOne', programPath('plain-a.ts'));

    assert.deepEqual(warnings, [
      "plain-a.ts: @muirjs/proteus-playwright turned Stryker's built-in mutators off for every file in this run, and this file does not look like Playwright test code (no @playwright/ import, no top-level test call). Mutate app code in a separate Stryker config.",
    ]);
  });

  it('warns once per file name, across calls and across mutators', async () => {
    const warnings: string[] = [];
    const mutate = await installedMutate((message) => warnings.push(message));

    mutate('MuirProteusPlaywrightOne', programPath('plain-once.ts'));
    mutate('MuirProteusPlaywrightTwo', programPath('plain-once.ts'));
    mutate('MuirProteusPlaywrightOne', programPath('plain-once.ts'));
    mutate('MuirProteusPlaywrightOne', programPath('plain-other.ts'));

    assert.deepEqual(
      warnings.map((message) => message.split(':')[0]),
      ['plain-once.ts', 'plain-other.ts'],
    );
  });

  for (const [title, path] of [
    [
      'a node that is no Program',
      programPath('plain-node.ts', { type: 'Identifier' }),
    ],
    ['a path with no hub', { node: emptyProgram }],
    ['a file name that is no string', programPath(42)],
  ]) {
    it(`stays silent for ${title}`, async () => {
      const warnings: string[] = [];
      const mutate = await installedMutate((message) => warnings.push(message));

      mutate('MuirProteusPlaywrightOne', path);

      assert.deepEqual(warnings, []);
    });
  }

  it('returns what the mutator returns', async () => {
    const mutate = await installedMutate(() => undefined);

    assert.deepEqual(
      mutate('MuirProteusPlaywrightOne', programPath('plain-return.ts')),
      [],
    );
  });

  for (const fileName of [
    'MuirProteusPlaywrightOne.self-check.tsx',
    'built-ins.self-check.tsx',
  ]) {
    it(`stays silent for the self-check sample ${fileName}`, async () => {
      const warnings: string[] = [];
      const mutate = await installedMutate((message) => warnings.push(message));

      mutate('MuirProteusPlaywrightOne', programPath(fileName));

      assert.deepEqual(warnings, []);
    });
  }

  for (const source of [
    "import { test } from '@playwright/test';\n",
    "test('a', async () => {});\n",
  ]) {
    it(`stays silent for a Program node of Playwright test code: ${source.trim()}`, async () => {
      const warnings: string[] = [];
      const mutate = await installedMutate((message) => warnings.push(message));

      mutate(
        'MuirProteusPlaywrightOne',
        programPath(`spec-${source.length}.ts`, await programOf(source)),
      );

      assert.deepEqual(warnings, []);
    });
  }
});

describe('install', () => {
  it("removes Stryker's 17 built-ins and appends the selected mutators, marked", async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await muirProteusPlaywrightInstall(
      sets(['MuirProteusPlaywrightOne', 'MuirProteusPlaywrightTwo']),
      undefined,
      async () => [instrumenter],
      () => undefined,
      () => undefined,
    );

    assert.deepEqual(names(), [
      'MuirProteusPlaywrightOne',
      'MuirProteusPlaywrightTwo',
    ]);
    assert.equal(
      instrumenter.allMutators.every((listed) => ownMark in listed),
      true,
    );
  });

  it("registers each mutator so that its mutate call gets the instrumenter's Babel types", async () => {
    const { instrumenter } = fakeInstrumenter();
    const echo = {
      name: 'MuirProteusPlaywrightEcho',
      sample: 'export const echo = 1;\n',
      mutate: (path: unknown, t: unknown) => [path, t],
    };

    await muirProteusPlaywrightInstall(
      { defaults: [echo], optIn: [], experimental: [] },
      undefined,
      async () => [instrumenter],
      () => undefined,
      () => undefined,
    );

    const listed = instrumenter.allMutators.find(
      ({ name }) => name === 'MuirProteusPlaywrightEcho',
    );
    const result: unknown = Reflect.apply(defined(listed).mutate, undefined, [
      'path',
    ]);

    assert.deepEqual(result, ['path', instrumenter.types]);
  });

  it('refuses a name that another mutator holds, ignoring case, and leaves the list as it was', async () => {
    const { instrumenter, names } = fakeInstrumenter({
      extra: [{ name: 'muirproteusplaywrightone', mutate: () => undefined }],
    });

    await assert.rejects(
      muirProteusPlaywrightInstall(
        sets(['MuirProteusPlaywrightOne', 'MuirProteusPlaywrightTwo']),
        undefined,
        async () => [instrumenter],
        () => undefined,
        () => undefined,
      ),
      {
        message:
          '@muirjs/proteus-playwright: another mutator already has the name MuirProteusPlaywrightOne.',
      },
    );
    assert.deepEqual(names(), [
      ...muirMoiraMutatorsBuiltInNames,
      'muirproteusplaywrightone',
    ]);
  });

  it('leaves exactly the second selection when it is called twice, and keeps the mutators of other packages', async () => {
    const sibling = {
      name: 'MuirProteusPlaywrightSibling',
      mutate: () => undefined,
      [muirMoiraMutatorsMarkOf('@muirjs/proteus-react')]: 1,
    };
    const { instrumenter, names } = fakeInstrumenter({ extra: [sibling] });
    const list = instrumenter.allMutators;
    const run = (mutatorNames: readonly string[]) =>
      muirProteusPlaywrightInstall(
        sets(mutatorNames),
        undefined,
        async () => [instrumenter],
        () => undefined,
        () => undefined,
      );

    await run(['MuirProteusPlaywrightOne', 'MuirProteusPlaywrightTwo']);
    await run(['MuirProteusPlaywrightTwo', 'MuirProteusPlaywrightThree']);

    assert.deepEqual(names(), [
      'MuirProteusPlaywrightSibling',
      'MuirProteusPlaywrightTwo',
      'MuirProteusPlaywrightThree',
    ]);
    assert.equal(instrumenter.allMutators, list);
  });

  it('prints one start line that counts the mutators on', async () => {
    const { instrumenter } = fakeInstrumenter();
    const lines: string[] = [];

    await muirProteusPlaywrightInstall(
      sets(['MuirProteusPlaywrightOne', 'MuirProteusPlaywrightTwo']),
      undefined,
      async () => [instrumenter],
      () => undefined,
      (message) => lines.push(message),
    );

    assert.deepEqual(lines, [
      "@muirjs/proteus-playwright: Stryker's 17 built-in mutators are off for every file in this run; 2 " +
        'MuirProteusPlaywright mutators on.',
    ]);
  });

  it('names the opt-in and experimental mutators that are on in the start line, in the order of the roster', async () => {
    const { instrumenter } = fakeInstrumenter();
    const lines: string[] = [];

    await muirProteusPlaywrightInstall(
      sets(
        ['MuirProteusPlaywrightOne'],
        ['MuirProteusPlaywrightTwo', 'MuirProteusPlaywrightThree'],
        ['MuirProteusPlaywrightFour'],
      ),
      { MuirProteusPlaywrightThree: true, experimental: true },
      async () => [instrumenter],
      () => undefined,
      (message) => lines.push(message),
    );

    assert.deepEqual(lines, [
      "@muirjs/proteus-playwright: Stryker's 17 built-in mutators are off for every file in this run; 3 " +
        'MuirProteusPlaywright mutators on. Opt-in or experimental: MuirProteusPlaywrightThree, MuirProteusPlaywrightFour.',
    ]);
  });

  for (const [title, options] of [
    ['the self-check', { silent: ['MuirProteusPlaywrightOne'] }],
    ['the check that the built-ins are gone', { leaking: ['Regex'] }],
  ] as const) {
    it(`leaves the list as it was when ${title} throws`, async () => {
      const { instrumenter, names } = fakeInstrumenter(options);
      const list = instrumenter.allMutators;

      await assert.rejects(
        muirProteusPlaywrightInstall(
          sets(['MuirProteusPlaywrightOne']),
          undefined,
          async () => [instrumenter],
          () => undefined,
          () => undefined,
        ),
      );

      assert.deepEqual(names(), muirMoiraMutatorsBuiltInNames);
      assert.equal(instrumenter.allMutators, list);
    });
  }

  it('prints no start line when a check throws', async () => {
    const { instrumenter } = fakeInstrumenter({
      silent: ['MuirProteusPlaywrightOne'],
    });
    const lines: string[] = [];

    await assert.rejects(
      muirProteusPlaywrightInstall(
        sets(['MuirProteusPlaywrightOne']),
        undefined,
        async () => [instrumenter],
        () => undefined,
        (message) => lines.push(message),
      ),
      {
        message:
          /made no mutants of MuirProteusPlaywrightOne from their samples/,
      },
    );

    assert.deepEqual(lines, []);
  });

  it('warns about an instrumenter version it was not tested with, after both checks passed', async () => {
    const { instrumenter } = fakeInstrumenter({ version: '10.2.0' });
    const warnings: string[] = [];

    await muirProteusPlaywrightInstall(
      sets(['MuirProteusPlaywrightOne']),
      undefined,
      async () => [instrumenter],
      (message) => warnings.push(message),
      () => undefined,
    );

    assert.deepEqual(warnings, [
      '@muirjs/proteus-playwright was tested with @stryker-mutator/instrumenter 10.1.1, not 10.2.0 in ' +
        '/stryker/instrumenter; its self-check passed.',
    ]);
  });

  it('throws, naming the built-ins that still made a mutant after the removal', async () => {
    const { instrumenter } = fakeInstrumenter({
      leaking: ['Regex', 'ArrowFunction'],
    });

    await assert.rejects(
      muirProteusPlaywrightInstall(
        sets(['MuirProteusPlaywrightOne']),
        undefined,
        async () => [instrumenter],
        () => undefined,
        () => undefined,
      ),
      {
        message:
          '@muirjs/proteus-playwright: the instrumenter 10.1.1 in /stryker/instrumenter still made mutants of the ' +
          'built-ins ArrowFunction, Regex after this package removed them, so it does not run the list this package changed. ' +
          'A bundled or second copy of the instrumenter does that.',
      },
    );
  });

  it('throws, naming every selected mutator whose sample made no mutant', async () => {
    const { instrumenter } = fakeInstrumenter({
      silent: ['MuirProteusPlaywrightOne', 'MuirProteusPlaywrightThree'],
    });

    await assert.rejects(
      muirProteusPlaywrightInstall(
        sets([
          'MuirProteusPlaywrightOne',
          'MuirProteusPlaywrightTwo',
          'MuirProteusPlaywrightThree',
        ]),
        undefined,
        async () => [instrumenter],
        () => undefined,
        () => undefined,
      ),
      {
        message:
          '@muirjs/proteus-playwright: the instrumenter 10.1.1 in /stryker/instrumenter made no mutants of MuirProteusPlaywrightOne, ' +
          'MuirProteusPlaywrightThree from their samples, so it does not run the mutators this module added. A bundled or second copy of the ' +
          'instrumenter does that.',
      },
    );
  });
});
