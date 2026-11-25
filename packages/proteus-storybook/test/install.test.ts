import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it, type TestContext } from 'node:test';

import {
  muirTempRoot,
  muirWriteTree,
} from '@muirjs/test-util-mutator-packages';

import {
  muirProteusStorybookInstall,
  muirProteusStorybookResolveFromCore,
} from '../src/install.ts';
import { muirProteusStorybookMutatorSets } from '../src/mutators.ts';
import {
  builtIns,
  fakeInstrumenter,
  ownMark,
  sets,
} from './support/fake-instrumenter.ts';

const silent = (): undefined => undefined;

describe('install', () => {
  it('ships MuirProteusStorybookArgs as opt-in: no option leaves it out, and its name turns it on', async () => {
    const without = fakeInstrumenter();
    const withArgs = fakeInstrumenter();

    await muirProteusStorybookInstall(
      muirProteusStorybookMutatorSets,
      undefined,
      async () => [without.instrumenter],
      silent,
      silent,
    );
    await muirProteusStorybookInstall(
      muirProteusStorybookMutatorSets,
      { MuirProteusStorybookArgs: true },
      async () => [withArgs.instrumenter],
      silent,
      silent,
    );

    assert.deepEqual(
      [without.names(), withArgs.names()],
      [builtIns, [...builtIns, 'MuirProteusStorybookArgs']],
    );
  });

  it("keeps Stryker's built-ins and appends the default mutators after them, marked", async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await muirProteusStorybookInstall(
      sets(['MuirProteusStorybookOne', 'MuirProteusStorybookTwo']),
      undefined,
      async () => [instrumenter],
      silent,
      silent,
    );

    assert.deepEqual(names(), [
      ...builtIns,
      'MuirProteusStorybookOne',
      'MuirProteusStorybookTwo',
    ]);
    assert.deepEqual(
      instrumenter.allMutators.map((listed) => ownMark in listed),
      [false, false, true, true],
    );
  });

  it('appends the opt-in and experimental mutators the options turn on, after the defaults', async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await muirProteusStorybookInstall(
      sets(
        ['MuirProteusStorybookOne'],
        ['MuirProteusStorybookTwo', 'MuirProteusStorybookThree'],
        ['MuirProteusStorybookFour'],
      ),
      { MuirProteusStorybookThree: true, experimental: true },
      async () => [instrumenter],
      silent,
      silent,
    );

    assert.deepEqual(names(), [
      ...builtIns,
      'MuirProteusStorybookOne',
      'MuirProteusStorybookThree',
      'MuirProteusStorybookFour',
    ]);
  });

  it('throws, naming its install function, on options when no tier but the defaults has a mutator', async () => {
    const { instrumenter } = fakeInstrumenter();

    await assert.rejects(
      muirProteusStorybookInstall(
        sets(['MuirProteusStorybookOne']),
        { MuirProteusStorybookOne: true },
        async () => [instrumenter],
        silent,
        silent,
      ),
      {
        message:
          '@muirjs/proteus-storybook: the package has no opt-in or experimental mutators yet, so ' +
          'muirProteusStorybookMutators() takes no options. Turn a mutator off with mutator.excludedMutations.',
      },
    );
  });

  it('throws when a mutator makes no mutant of its sample, and leaves the list as it was', async () => {
    const { instrumenter, names } = fakeInstrumenter({
      silent: ['MuirProteusStorybookTwo'],
    });

    await assert.rejects(
      muirProteusStorybookInstall(
        sets(['MuirProteusStorybookOne', 'MuirProteusStorybookTwo']),
        undefined,
        async () => [instrumenter],
        silent,
        silent,
      ),
      {
        message:
          /made no mutants of MuirProteusStorybookTwo from their samples/,
      },
    );
    assert.deepEqual(names(), builtIns);
  });

  it('refuses a name that another mutator holds, ignoring case', async () => {
    const { instrumenter } = fakeInstrumenter();

    await assert.rejects(
      muirProteusStorybookInstall(
        sets(['Objectliteral']),
        undefined,
        async () => [instrumenter],
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

    await muirProteusStorybookInstall(
      sets(['MuirProteusStorybookOne']),
      undefined,
      async () => [instrumenter],
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

    await muirProteusStorybookInstall(
      sets(['MuirProteusStorybookOne', 'MuirProteusStorybookTwo']),
      undefined,
      async () => [instrumenter],
      silent,
      (message) => lines.push(message),
    );

    assert.deepEqual(lines, [
      "@muirjs/proteus-storybook: 2 MuirProteusStorybook mutators on, beside Stryker's built-in mutators.",
    ]);
  });

  it('names the opt-in and experimental mutators that are on in the start line, in roster order', async () => {
    const { instrumenter } = fakeInstrumenter();
    const lines: string[] = [];

    await muirProteusStorybookInstall(
      sets(
        ['MuirProteusStorybookOne'],
        ['MuirProteusStorybookTwo', 'MuirProteusStorybookThree'],
        ['MuirProteusStorybookFour'],
      ),
      { MuirProteusStorybookThree: true, experimental: true },
      async () => [instrumenter],
      silent,
      (message) => lines.push(message),
    );

    assert.deepEqual(lines, [
      "@muirjs/proteus-storybook: 3 MuirProteusStorybook mutators on, beside Stryker's built-in mutators. " +
        'Opt-in or experimental: MuirProteusStorybookThree, MuirProteusStorybookFour.',
    ]);
  });
});

describe('resolveFromCore against a fake instrumenter', () => {
  const babel = import.meta.resolve('@babel/core');

  function fakeCore(t: TestContext, typesSource: string) {
    const modules = join(
      muirTempRoot(t, 'storybook-mutators-core-'),
      'node_modules',
    );

    muirWriteTree(modules, {
      '@stryker-mutator/core/package.json':
        '{ "name": "@stryker-mutator/core", "version": "9.9.9" }',
      '@stryker-mutator/instrumenter/package.json':
        '{ "name": "@stryker-mutator/instrumenter", "version": "9.9.8", "type": "module", ' +
        '"exports": { ".": "./dist/src/index.js", "./package.json": "./package.json" } }',
      '@stryker-mutator/instrumenter/dist/src/transformers/babel-transformer.js':
        'export function transformBabel() {}',
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

    await assert.rejects(muirProteusStorybookResolveFromCore(corePackage), {
      message: `@muirjs/proteus-storybook: the instrumenter 9.9.8 in ${dir} has no Babel types with objectExpression.`,
    });
  });

  it('throws, listing every Babel types member that is missing', async (t) => {
    const { corePackage, dir } = fakeCore(t, '{}');

    await assert.rejects(muirProteusStorybookResolveFromCore(corePackage), {
      message: `@muirjs/proteus-storybook: the instrumenter 9.9.8 in ${dir} has no Babel types with cloneNode, objectExpression.`,
    });
  });
});
