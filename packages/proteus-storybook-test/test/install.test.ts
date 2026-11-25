import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { types } from '@babel/core';

import { muirMoiraMutatorsBuiltInNames } from '@muirjs/moira-mutators';

import {
  muirProteusStorybookTestAssertBabelTypes,
  muirProteusStorybookTestInstall,
} from '../src/install.ts';
import { muirProteusStorybookTestMutatorSets } from '../src/mutators.ts';
import { defined } from './support/defined.ts';
import {
  fakeInstrumenter,
  mutator,
  ownMark,
  sets,
} from './support/fake-instrumenter.ts';

const silent = (): undefined => undefined;

describe('assertBabelTypes', () => {
  const missing = (name: string) => new Error(`no ${name}`);

  it("accepts Babel's types", () => {
    assert.doesNotThrow(() =>
      muirProteusStorybookTestAssertBabelTypes(types, missing),
    );
  });

  it('names the member an object lacks, through the missing-member error', () => {
    assert.throws(
      () =>
        muirProteusStorybookTestAssertBabelTypes(
          { ...types, identifier: 1 },
          missing,
        ),
      { message: 'no Babel types with identifier' },
    );
  });

  it('lists every member a value lacks, comma-separated', () => {
    assert.throws(
      () => muirProteusStorybookTestAssertBabelTypes(undefined, missing),
      {
        message:
          'no Babel types with arrowFunctionExpression, awaitExpression, blockStatement, callExpression, cloneNode, emptyStatement, expressionStatement, identifier, isNode, isStatement, memberExpression, newExpression, objectExpression, sequenceExpression, stringLiteral',
      },
    );
  });
});

describe('install', () => {
  it("removes Stryker's 17 built-ins and appends the default mutators, marked", async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await muirProteusStorybookTestInstall(
      sets(['MuirProteusStorybookTestOne', 'MuirProteusStorybookTestTwo']),
      undefined,
      async () => [instrumenter],
      silent,
      silent,
    );

    assert.deepEqual(names(), [
      'MuirProteusStorybookTestOne',
      'MuirProteusStorybookTestTwo',
    ]);
    assert.equal(
      instrumenter.allMutators.every((listed) => ownMark in listed),
      true,
    );
  });

  it('appends the opt-in and experimental mutators the options turn on, after the defaults', async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await muirProteusStorybookTestInstall(
      sets(
        ['MuirProteusStorybookTestOne'],
        ['MuirProteusStorybookTestTwo', 'MuirProteusStorybookTestThree'],
        ['MuirProteusStorybookTestFour'],
      ),
      { MuirProteusStorybookTestThree: true, experimental: true },
      async () => [instrumenter],
      silent,
      silent,
    );

    assert.deepEqual(names(), [
      'MuirProteusStorybookTestOne',
      'MuirProteusStorybookTestThree',
      'MuirProteusStorybookTestFour',
    ]);
  });

  it('throws on an experimental name given as an opt-in key, and leaves the list as it was', async () => {
    const { instrumenter, names } = fakeInstrumenter();
    const before = names();

    await assert.rejects(
      muirProteusStorybookTestInstall(
        sets(
          ['MuirProteusStorybookTestOne'],
          ['MuirProteusStorybookTestTwo'],
          ['MuirProteusStorybookTestFour'],
        ),
        { MuirProteusStorybookTestFour: true },
        async () => [instrumenter],
        silent,
        silent,
      ),
      {
        message:
          '@muirjs/proteus-storybook-test: no opt-in mutator is named MuirProteusStorybookTestFour; it is experimental, so it ' +
          'goes inside experimental.',
      },
    );
    assert.deepEqual(names(), before);
  });

  it('throws, naming its install function, on a tier key whose tier is empty', async () => {
    const { instrumenter } = fakeInstrumenter();

    await assert.rejects(
      muirProteusStorybookTestInstall(
        sets(
          ['MuirProteusStorybookTestOne'],
          [],
          ['MuirProteusStorybookTestFour'],
        ),
        { extended: true },
        async () => [instrumenter],
        silent,
        silent,
      ),
      {
        message:
          '@muirjs/proteus-storybook-test: the package has no opt-in mutators yet, so ' +
          'muirProteusStorybookTestMutators() takes no extended option.',
      },
    );
  });

  it('prints one start line that counts the mutators on', async () => {
    const { instrumenter } = fakeInstrumenter();
    const lines: string[] = [];

    await muirProteusStorybookTestInstall(
      sets(['MuirProteusStorybookTestOne', 'MuirProteusStorybookTestTwo']),
      undefined,
      async () => [instrumenter],
      silent,
      (message) => lines.push(message),
    );

    assert.deepEqual(lines, [
      "@muirjs/proteus-storybook-test: Stryker's 17 built-in mutators are off for every file in this run; " +
        '2 MuirProteusStorybookTest mutators on.',
    ]);
  });

  it('names the opt-in and experimental mutators that are on in the start line, in roster order', async () => {
    const { instrumenter } = fakeInstrumenter();
    const lines: string[] = [];

    await muirProteusStorybookTestInstall(
      sets(
        ['MuirProteusStorybookTestOne'],
        ['MuirProteusStorybookTestTwo', 'MuirProteusStorybookTestThree'],
        ['MuirProteusStorybookTestFour'],
      ),
      { MuirProteusStorybookTestThree: true, experimental: true },
      async () => [instrumenter],
      silent,
      (message) => lines.push(message),
    );

    assert.deepEqual(lines, [
      "@muirjs/proteus-storybook-test: Stryker's 17 built-in mutators are off for every file in this run; " +
        '3 MuirProteusStorybookTest mutators on. Opt-in or experimental: MuirProteusStorybookTestThree, MuirProteusStorybookTestFour.',
    ]);
  });

  it("registers each mutator so that its mutate call gets the instrumenter's Babel types", async () => {
    const { instrumenter } = fakeInstrumenter();
    const calls: unknown[] = [];
    const echo = {
      ...mutator('MuirProteusStorybookTestEcho'),
      mutate: (path: unknown, t: unknown) => {
        calls.push([path, t]);

        return [];
      },
    };

    await muirProteusStorybookTestInstall(
      { defaults: [echo], optIn: [], experimental: [] },
      undefined,
      async () => [instrumenter],
      silent,
      silent,
    );
    Reflect.apply(defined(instrumenter.allMutators[0]).mutate, undefined, [
      'path',
    ]);

    assert.deepEqual(calls, [['path', instrumenter.types]]);
  });

  it('throws when a mutator makes no mutant of its sample, and leaves the list as it was', async () => {
    const { instrumenter, names } = fakeInstrumenter({
      silent: ['MuirProteusStorybookTestTwo'],
    });

    await assert.rejects(
      muirProteusStorybookTestInstall(
        sets(['MuirProteusStorybookTestOne', 'MuirProteusStorybookTestTwo']),
        undefined,
        async () => [instrumenter],
        silent,
        silent,
      ),
      {
        message:
          /made no mutants of MuirProteusStorybookTestTwo from their samples/,
      },
    );
    assert.deepEqual(names(), muirMoiraMutatorsBuiltInNames);
  });

  it('throws when a built-in still makes a mutant after the removal, and leaves the list as it was', async () => {
    const { instrumenter, names } = fakeInstrumenter({ leaking: ['Regex'] });

    await assert.rejects(
      muirProteusStorybookTestInstall(
        sets(['MuirProteusStorybookTestOne']),
        undefined,
        async () => [instrumenter],
        silent,
        silent,
      ),
      { message: /still made mutants of the built-ins Regex/ },
    );
    assert.deepEqual(names(), muirMoiraMutatorsBuiltInNames);
  });

  it('refuses a name that another mutator holds, ignoring case', async () => {
    const { instrumenter } = fakeInstrumenter();

    instrumenter.allMutators.push({
      name: 'muirproteusstorybooktestone',
      mutate: () => undefined,
    });

    await assert.rejects(
      muirProteusStorybookTestInstall(
        sets(['MuirProteusStorybookTestOne']),
        undefined,
        async () => [instrumenter],
        silent,
        silent,
      ),
      {
        message:
          '@muirjs/proteus-storybook-test: another mutator already has the name MuirProteusStorybookTestOne.',
      },
    );
  });

  it('warns about an instrumenter version it was not tested with', async () => {
    const { instrumenter } = fakeInstrumenter({ version: '10.2.0' });
    const warnings: string[] = [];

    await muirProteusStorybookTestInstall(
      sets(['MuirProteusStorybookTestOne']),
      undefined,
      async () => [instrumenter],
      (message) => warnings.push(message),
      silent,
    );

    assert.deepEqual(warnings, [
      '@muirjs/proteus-storybook-test was tested with @stryker-mutator/instrumenter 10.1.1, not 10.2.0 in ' +
        '/stryker/instrumenter; its self-check passed.',
    ]);
  });
});

describe('roster', () => {
  async function namesWith(options: unknown): Promise<readonly string[]> {
    const { instrumenter, names } = fakeInstrumenter();

    await muirProteusStorybookTestInstall(
      muirProteusStorybookTestMutatorSets,
      options,
      async () => [instrumenter],
      silent,
      silent,
    );

    return names();
  }

  const defaults = [
    'MuirProteusStorybookTestInteraction',
    'MuirProteusStorybookTestClickFocus',
  ];

  it('installs the default mutators with no options', async () => {
    assert.deepEqual(await namesWith(undefined), defaults);
  });

  it('turns MuirProteusStorybookTestInteractionRepeat on by its name, after the defaults', async () => {
    assert.deepEqual(
      await namesWith({ MuirProteusStorybookTestInteractionRepeat: true }),
      [...defaults, 'MuirProteusStorybookTestInteractionRepeat'],
    );
  });

  it('turns MuirProteusStorybookTestInteractionTarget on by its name inside experimental', async () => {
    assert.deepEqual(
      await namesWith({
        experimental: { MuirProteusStorybookTestInteractionTarget: true },
      }),
      [...defaults, 'MuirProteusStorybookTestInteractionTarget'],
    );
  });

  it('turns MuirProteusStorybookTestWaitFor on by its name inside experimental', async () => {
    assert.deepEqual(
      await namesWith({
        experimental: { MuirProteusStorybookTestWaitFor: true },
      }),
      [...defaults, 'MuirProteusStorybookTestWaitFor'],
    );
  });

  it('turns MuirProteusStorybookTestAssertionBefore on by its name inside experimental', async () => {
    assert.deepEqual(
      await namesWith({
        experimental: { MuirProteusStorybookTestAssertionBefore: true },
      }),
      [...defaults, 'MuirProteusStorybookTestAssertionBefore'],
    );
  });

  it('turns MuirProteusStorybookTestSpyStub on by its name inside experimental', async () => {
    assert.deepEqual(
      await namesWith({
        experimental: { MuirProteusStorybookTestSpyStub: true },
      }),
      [...defaults, 'MuirProteusStorybookTestSpyStub'],
    );
  });

  it('turns MuirProteusStorybookTestSpyStubOutcome on by its name inside experimental', async () => {
    assert.deepEqual(
      await namesWith({
        experimental: { MuirProteusStorybookTestSpyStubOutcome: true },
      }),
      [...defaults, 'MuirProteusStorybookTestSpyStubOutcome'],
    );
  });

  it('turns MuirProteusStorybookTestStoryGlobals on by its name inside experimental', async () => {
    assert.deepEqual(
      await namesWith({
        experimental: { MuirProteusStorybookTestStoryGlobals: true },
      }),
      [...defaults, 'MuirProteusStorybookTestStoryGlobals'],
    );
  });

  it('refuses MuirProteusStorybookTestWaitFor as an opt-in key, as it is experimental', async () => {
    await assert.rejects(namesWith({ MuirProteusStorybookTestWaitFor: true }), {
      message:
        '@muirjs/proteus-storybook-test: no opt-in mutator is named MuirProteusStorybookTestWaitFor; it is ' +
        'experimental, so it goes inside experimental.',
    });
  });

  it('refuses MuirProteusStorybookTestAssertionBefore as an opt-in key, as it is experimental', async () => {
    await assert.rejects(
      namesWith({ MuirProteusStorybookTestAssertionBefore: true }),
      {
        message:
          '@muirjs/proteus-storybook-test: no opt-in mutator is named MuirProteusStorybookTestAssertionBefore; it is ' +
          'experimental, so it goes inside experimental.',
      },
    );
  });

  it('refuses MuirProteusStorybookTestInteractionRepeat inside experimental, as it is opt-in', async () => {
    await assert.rejects(
      namesWith({
        experimental: { MuirProteusStorybookTestInteractionRepeat: true },
      }),
      {
        message:
          '@muirjs/proteus-storybook-test: no experimental mutator is named MuirProteusStorybookTestInteractionRepeat; ' +
          'it is opt-in, so it goes outside experimental.',
      },
    );
  });

  it('turns every opt-in mutator on with extended', async () => {
    assert.deepEqual(await namesWith({ extended: true }), [
      ...defaults,
      'MuirProteusStorybookTestInteractionRepeat',
    ]);
  });
});
