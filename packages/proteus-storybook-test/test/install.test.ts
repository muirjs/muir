import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { types } from '@babel/core';

import { builtInNames } from '@muirjs/moira-mutators';

import { assertBabelTypes, install } from '../src/install.ts';
import { mutatorSets } from '../src/mutators.ts';
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
    assert.doesNotThrow(() => assertBabelTypes(types, missing));
  });

  it('names the member an object lacks, through the missing-member error', () => {
    assert.throws(
      () => assertBabelTypes({ ...types, identifier: 1 }, missing),
      { message: 'no Babel types with identifier' },
    );
  });

  it('lists every member a value lacks, comma-separated', () => {
    assert.throws(() => assertBabelTypes(undefined, missing), {
      message:
        'no Babel types with arrowFunctionExpression, awaitExpression, blockStatement, callExpression, cloneNode, emptyStatement, expressionStatement, identifier, isNode, isStatement, memberExpression, newExpression, objectExpression, sequenceExpression, stringLiteral',
    });
  });
});

describe('install', () => {
  it("removes Stryker's 17 built-ins and appends the default mutators, marked", async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await install(
      sets(['LzOne', 'LzTwo']),
      undefined,
      async () => instrumenter,
      silent,
      silent,
    );

    assert.deepEqual(names(), ['LzOne', 'LzTwo']);
    assert.equal(
      instrumenter.allMutators.every((listed) => ownMark in listed),
      true,
    );
  });

  it('appends the opt-in and experimental mutators the options turn on, after the defaults', async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await install(
      sets(['LzOne'], ['LzTwo', 'LzThree'], ['LzFour']),
      { LzThree: true, experimental: true },
      async () => instrumenter,
      silent,
      silent,
    );

    assert.deepEqual(names(), ['LzOne', 'LzThree', 'LzFour']);
  });

  it('throws on an experimental name given as an opt-in key, and leaves the list as it was', async () => {
    const { instrumenter, names } = fakeInstrumenter();
    const before = names();

    await assert.rejects(
      install(
        sets(['LzOne'], ['LzTwo'], ['LzFour']),
        { LzFour: true },
        async () => instrumenter,
        silent,
        silent,
      ),
      {
        message:
          '@muirjs/proteus-storybook-test: no opt-in mutator is named LzFour; it is experimental, so it ' +
          'goes inside experimental.',
      },
    );
    assert.deepEqual(names(), before);
  });

  it('throws, naming its install function, on a tier key whose tier is empty', async () => {
    const { instrumenter } = fakeInstrumenter();

    await assert.rejects(
      install(
        sets(['LzOne'], [], ['LzFour']),
        { extended: true },
        async () => instrumenter,
        silent,
        silent,
      ),
      {
        message:
          '@muirjs/proteus-storybook-test: the package has no opt-in mutators yet, so ' +
          'lzStorybookTestMutators() takes no extended option.',
      },
    );
  });

  it('prints one start line that counts the mutators on', async () => {
    const { instrumenter } = fakeInstrumenter();
    const lines: string[] = [];

    await install(
      sets(['LzOne', 'LzTwo']),
      undefined,
      async () => instrumenter,
      silent,
      (message) => lines.push(message),
    );

    assert.deepEqual(lines, [
      "@muirjs/proteus-storybook-test: Stryker's 17 built-in mutators are off for every file in this run; " +
        '2 LzStorybook mutators on.',
    ]);
  });

  it('names the opt-in and experimental mutators that are on in the start line, in roster order', async () => {
    const { instrumenter } = fakeInstrumenter();
    const lines: string[] = [];

    await install(
      sets(['LzOne'], ['LzTwo', 'LzThree'], ['LzFour']),
      { LzThree: true, experimental: true },
      async () => instrumenter,
      silent,
      (message) => lines.push(message),
    );

    assert.deepEqual(lines, [
      "@muirjs/proteus-storybook-test: Stryker's 17 built-in mutators are off for every file in this run; " +
        '3 LzStorybook mutators on. Opt-in or experimental: LzThree, LzFour.',
    ]);
  });

  it("registers each mutator so that its mutate call gets the instrumenter's Babel types", async () => {
    const { instrumenter } = fakeInstrumenter();
    const calls: unknown[] = [];
    const echo = {
      ...mutator('LzEcho'),
      mutate: (path: unknown, t: unknown) => {
        calls.push([path, t]);

        return [];
      },
    };

    await install(
      { defaults: [echo], optIn: [], experimental: [] },
      undefined,
      async () => instrumenter,
      silent,
      silent,
    );
    Reflect.apply(defined(instrumenter.allMutators[0]).mutate, undefined, [
      'path',
    ]);

    assert.deepEqual(calls, [['path', instrumenter.types]]);
  });

  it('throws when a mutator makes no mutant of its sample, and leaves the list as it was', async () => {
    const { instrumenter, names } = fakeInstrumenter({ silent: ['LzTwo'] });

    await assert.rejects(
      install(
        sets(['LzOne', 'LzTwo']),
        undefined,
        async () => instrumenter,
        silent,
        silent,
      ),
      { message: /made no mutants of LzTwo from their samples/ },
    );
    assert.deepEqual(names(), builtInNames);
  });

  it('throws when a built-in still makes a mutant after the removal, and leaves the list as it was', async () => {
    const { instrumenter, names } = fakeInstrumenter({ leaking: ['Regex'] });

    await assert.rejects(
      install(
        sets(['LzOne']),
        undefined,
        async () => instrumenter,
        silent,
        silent,
      ),
      { message: /still made mutants of the built-ins Regex/ },
    );
    assert.deepEqual(names(), builtInNames);
  });

  it('refuses a name that another mutator holds, ignoring case', async () => {
    const { instrumenter } = fakeInstrumenter();

    instrumenter.allMutators.push({ name: 'lzone', mutate: () => undefined });

    await assert.rejects(
      install(
        sets(['LzOne']),
        undefined,
        async () => instrumenter,
        silent,
        silent,
      ),
      {
        message:
          '@muirjs/proteus-storybook-test: another mutator already has the name LzOne.',
      },
    );
  });

  it('warns about an instrumenter version it was not tested with', async () => {
    const { instrumenter } = fakeInstrumenter({ version: '10.2.0' });
    const warnings: string[] = [];

    await install(
      sets(['LzOne']),
      undefined,
      async () => instrumenter,
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

    await install(
      mutatorSets,
      options,
      async () => instrumenter,
      silent,
      silent,
    );

    return names();
  }

  const defaults = ['LzStorybookInteraction', 'LzStorybookClickFocus'];

  it('installs the default mutators with no options', async () => {
    assert.deepEqual(await namesWith(undefined), defaults);
  });

  it('turns LzStorybookInteractionRepeat on by its name, after the defaults', async () => {
    assert.deepEqual(await namesWith({ LzStorybookInteractionRepeat: true }), [
      ...defaults,
      'LzStorybookInteractionRepeat',
    ]);
  });

  it('turns LzStorybookInteractionTarget on by its name inside experimental', async () => {
    assert.deepEqual(
      await namesWith({
        experimental: { LzStorybookInteractionTarget: true },
      }),
      [...defaults, 'LzStorybookInteractionTarget'],
    );
  });

  it('turns LzStorybookWaitFor on by its name inside experimental', async () => {
    assert.deepEqual(
      await namesWith({ experimental: { LzStorybookWaitFor: true } }),
      [...defaults, 'LzStorybookWaitFor'],
    );
  });

  it('turns LzStorybookAssertionBefore on by its name inside experimental', async () => {
    assert.deepEqual(
      await namesWith({ experimental: { LzStorybookAssertionBefore: true } }),
      [...defaults, 'LzStorybookAssertionBefore'],
    );
  });

  it('turns LzStorybookSpyStub on by its name inside experimental', async () => {
    assert.deepEqual(
      await namesWith({ experimental: { LzStorybookSpyStub: true } }),
      [...defaults, 'LzStorybookSpyStub'],
    );
  });

  it('turns LzStorybookSpyStubOutcome on by its name inside experimental', async () => {
    assert.deepEqual(
      await namesWith({ experimental: { LzStorybookSpyStubOutcome: true } }),
      [...defaults, 'LzStorybookSpyStubOutcome'],
    );
  });

  it('turns LzStorybookStoryGlobals on by its name inside experimental', async () => {
    assert.deepEqual(
      await namesWith({ experimental: { LzStorybookStoryGlobals: true } }),
      [...defaults, 'LzStorybookStoryGlobals'],
    );
  });

  it('refuses LzStorybookWaitFor as an opt-in key, as it is experimental', async () => {
    await assert.rejects(namesWith({ LzStorybookWaitFor: true }), {
      message:
        '@muirjs/proteus-storybook-test: no opt-in mutator is named LzStorybookWaitFor; it is ' +
        'experimental, so it goes inside experimental.',
    });
  });

  it('refuses LzStorybookAssertionBefore as an opt-in key, as it is experimental', async () => {
    await assert.rejects(namesWith({ LzStorybookAssertionBefore: true }), {
      message:
        '@muirjs/proteus-storybook-test: no opt-in mutator is named LzStorybookAssertionBefore; it is ' +
        'experimental, so it goes inside experimental.',
    });
  });

  it('refuses LzStorybookInteractionRepeat inside experimental, as it is opt-in', async () => {
    await assert.rejects(
      namesWith({ experimental: { LzStorybookInteractionRepeat: true } }),
      {
        message:
          '@muirjs/proteus-storybook-test: no experimental mutator is named LzStorybookInteractionRepeat; ' +
          'it is opt-in, so it goes outside experimental.',
      },
    );
  });

  it('turns every opt-in mutator on with extended', async () => {
    assert.deepEqual(await namesWith({ extended: true }), [
      ...defaults,
      'LzStorybookInteractionRepeat',
    ]);
  });
});
