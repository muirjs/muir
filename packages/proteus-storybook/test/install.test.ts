import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it, type TestContext } from 'node:test';

import { tempRoot, writeTree } from '@muirjs/test-util-mutator-packages';

import { install, resolveFromCore } from '../src/install.ts';
import { mutatorSets } from '../src/mutators.ts';
import {
  builtIns,
  fakeInstrumenter,
  ownMark,
  sets,
} from './support/fake-instrumenter.ts';

const silent = (): undefined => undefined;

describe('install', () => {
  it('ships LzStorybookArgs as opt-in: no option leaves it out, and its name turns it on', async () => {
    const without = fakeInstrumenter();
    const withArgs = fakeInstrumenter();

    await install(
      mutatorSets,
      undefined,
      async () => without.instrumenter,
      silent,
      silent,
    );
    await install(
      mutatorSets,
      { LzStorybookArgs: true },
      async () => withArgs.instrumenter,
      silent,
      silent,
    );

    assert.deepEqual(
      [without.names(), withArgs.names()],
      [builtIns, [...builtIns, 'LzStorybookArgs']],
    );
  });

  it("keeps Stryker's built-ins and appends the default mutators after them, marked", async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await install(
      sets(['LzOne', 'LzTwo']),
      undefined,
      async () => instrumenter,
      silent,
      silent,
    );

    assert.deepEqual(names(), [...builtIns, 'LzOne', 'LzTwo']);
    assert.deepEqual(
      instrumenter.allMutators.map((listed) => ownMark in listed),
      [false, false, true, true],
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

    assert.deepEqual(names(), [...builtIns, 'LzOne', 'LzThree', 'LzFour']);
  });

  it('throws, naming its install function, on options when no tier but the defaults has a mutator', async () => {
    const { instrumenter } = fakeInstrumenter();

    await assert.rejects(
      install(
        sets(['LzOne']),
        { LzOne: true },
        async () => instrumenter,
        silent,
        silent,
      ),
      {
        message:
          '@muirjs/proteus-storybook: the package has no opt-in or experimental mutators yet, so ' +
          'lzStorybookMutators() takes no options. Turn a mutator off with mutator.excludedMutations.',
      },
    );
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
    assert.deepEqual(names(), builtIns);
  });

  it('refuses a name that another mutator holds, ignoring case', async () => {
    const { instrumenter } = fakeInstrumenter();

    await assert.rejects(
      install(
        sets(['Objectliteral']),
        undefined,
        async () => instrumenter,
        silent,
        silent,
      ),
      {
        message:
          '@muirjs/proteus-storybook: another mutator already has the name Objectliteral.',
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
      '@muirjs/proteus-storybook was tested with @stryker-mutator/instrumenter 10.1.1, not 10.2.0 in ' +
        '/stryker/instrumenter; its self-check passed.',
    ]);
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
      "@muirjs/proteus-storybook: 2 LzStorybook mutators on, beside Stryker's built-in mutators.",
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
      "@muirjs/proteus-storybook: 3 LzStorybook mutators on, beside Stryker's built-in mutators. " +
        'Opt-in or experimental: LzThree, LzFour.',
    ]);
  });
});

describe('resolveFromCore against a fake instrumenter', () => {
  const babel = import.meta.resolve('@babel/core');

  function fakeCore(t: TestContext, typesSource: string) {
    const modules = join(
      tempRoot(t, 'storybook-mutators-core-'),
      'node_modules',
    );

    writeTree(modules, {
      '@stryker-mutator/core/package.json':
        '{ "name": "@stryker-mutator/core", "version": "9.9.9" }',
      '@stryker-mutator/instrumenter/package.json':
        '{ "name": "@stryker-mutator/instrumenter", "version": "9.9.8", "type": "module" }',
      '@stryker-mutator/instrumenter/dist/src/mutators/mutate.js':
        'export const allMutators = [];',
      '@stryker-mutator/instrumenter/dist/src/mutant-placers/index.js':
        'export const allMutantPlacers = [];',
      '@stryker-mutator/instrumenter/dist/src/index.js':
        'export class Instrumenter { async instrument() { return { files: [], mutants: [] }; } }',
      '@babel/core/package.json':
        '{ "name": "@babel/core", "type": "module", "main": "index.js" }',
      '@babel/core/index.js':
        `import { types as real } from ${JSON.stringify(babel)};\n` +
        `export const types = ${typesSource};`,
    });

    return {
      corePackage: join(modules, '@stryker-mutator', 'core', 'package.json'),
      dir: join(modules, '@stryker-mutator', 'instrumenter'),
    };
  }

  it('throws, naming the Babel types member that is no function', async (t) => {
    const { corePackage, dir } = fakeCore(
      t,
      '{ ...real, objectExpression: 1 }',
    );

    await assert.rejects(resolveFromCore(corePackage), {
      message: `@muirjs/proteus-storybook: the instrumenter 9.9.8 in ${dir} has no Babel types with objectExpression.`,
    });
  });

  it('throws, listing every Babel types member that is missing', async (t) => {
    const { corePackage, dir } = fakeCore(t, '{}');

    await assert.rejects(resolveFromCore(corePackage), {
      message: `@muirjs/proteus-storybook: the instrumenter 9.9.8 in ${dir} has no Babel types with cloneNode, objectExpression.`,
    });
  });
});
