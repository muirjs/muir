import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it, type TestContext } from 'node:test';

import {
  muirTempRoot,
  muirWriteTree,
} from '@muirjs/test-util-mutator-packages';

import {
  muirProteusMswInstall,
  muirProteusMswResolveFromCore,
} from '../src/install.ts';
import { muirProteusMswMutatorSets } from '../src/mutators.ts';
import {
  builtIns,
  fakeInstrumenter,
  ownMark,
  sets,
} from './support/fake-instrumenter.ts';

const silent = (): undefined => undefined;

describe('install', () => {
  it('ships MuirProteusMswResponse as a default, so that no option installs it', async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await muirProteusMswInstall(
      muirProteusMswMutatorSets,
      undefined,
      async () => instrumenter,
      silent,
      silent,
    );

    assert.deepEqual(names(), [...builtIns, 'MuirProteusMswResponse']);
  });

  it("appends the experimental mutators that experimental turns on after Stryker's built-ins, marked", async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await muirProteusMswInstall(
      sets([], [], ['MuirProteusMswOne']),
      { experimental: true },
      async () => instrumenter,
      silent,
      silent,
    );

    assert.deepEqual(names(), [...builtIns, 'MuirProteusMswOne']);
    assert.deepEqual(
      instrumenter.allMutators.map((listed) => ownMark in listed),
      [false, false, true],
    );
  });

  it('installs no experimental mutator without options', async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await muirProteusMswInstall(
      sets([], [], ['MuirProteusMswOne']),
      undefined,
      async () => instrumenter,
      silent,
      silent,
    );

    assert.deepEqual(names(), builtIns);
  });

  it('says in its start line that no mutator is on and how to turn the experimental ones on', async () => {
    const { instrumenter } = fakeInstrumenter();
    const lines: string[] = [];

    await muirProteusMswInstall(
      sets([], [], ['MuirProteusMswOne', 'MuirProteusMswTwo']),
      undefined,
      async () => instrumenter,
      silent,
      (message) => lines.push(message),
    );

    assert.deepEqual(lines, [
      "@muirjs/proteus-msw: 0 MuirProteusMsw mutators on, beside Stryker's built-in mutators. Off as " +
        'experimental: MuirProteusMswOne, MuirProteusMswTwo; muirProteusMswMutators({ experimental: true }) turns them on.',
    ]);
  });

  it('names the experimental mutators that are on in the start line, in roster order', async () => {
    const { instrumenter } = fakeInstrumenter();
    const lines: string[] = [];

    await muirProteusMswInstall(
      sets([], [], ['MuirProteusMswOne', 'MuirProteusMswTwo']),
      { experimental: true },
      async () => instrumenter,
      silent,
      (message) => lines.push(message),
    );

    assert.deepEqual(lines, [
      "@muirjs/proteus-msw: 2 MuirProteusMsw mutators on, beside Stryker's built-in mutators. " +
        'Experimental: MuirProteusMswOne, MuirProteusMswTwo.',
    ]);
  });

  it('only counts the mutators on in the start line when all of them run by default', async () => {
    const { instrumenter } = fakeInstrumenter();
    const lines: string[] = [];

    await muirProteusMswInstall(
      sets(['MuirProteusMswOne'], [], ['MuirProteusMswTwo']),
      undefined,
      async () => instrumenter,
      silent,
      (message) => lines.push(message),
    );

    assert.deepEqual(lines, [
      "@muirjs/proteus-msw: 1 MuirProteusMsw mutators on, beside Stryker's built-in mutators.",
    ]);
  });

  it('throws, naming its install function, on options when no tier but the defaults has a mutator', async () => {
    const { instrumenter } = fakeInstrumenter();

    await assert.rejects(
      muirProteusMswInstall(
        sets(['MuirProteusMswOne']),
        { MuirProteusMswOne: true },
        async () => instrumenter,
        silent,
        silent,
      ),
      {
        message:
          '@muirjs/proteus-msw: the package has no opt-in or experimental mutators yet, so ' +
          'muirProteusMswMutators() takes no options. Turn a mutator off with mutator.excludedMutations.',
      },
    );
  });

  it('throws when a mutator makes no mutant of its sample, and leaves the list as it was', async () => {
    const { instrumenter, names } = fakeInstrumenter({
      silent: ['MuirProteusMswTwo'],
    });

    await assert.rejects(
      muirProteusMswInstall(
        sets([], [], ['MuirProteusMswOne', 'MuirProteusMswTwo']),
        { experimental: true },
        async () => instrumenter,
        silent,
        silent,
      ),
      { message: /made no mutants of MuirProteusMswTwo from their samples/ },
    );
    assert.deepEqual(names(), builtIns);
  });

  it('refuses a name that another mutator holds, ignoring case', async () => {
    const { instrumenter } = fakeInstrumenter();

    await assert.rejects(
      muirProteusMswInstall(
        sets([], [], ['Objectliteral']),
        { experimental: true },
        async () => instrumenter,
        silent,
        silent,
      ),
      {
        message:
          '@muirjs/proteus-msw: another mutator already has the name Objectliteral.',
      },
    );
  });

  it('warns about an instrumenter version it was not tested with', async () => {
    const { instrumenter } = fakeInstrumenter({ version: '10.2.0' });
    const warnings: string[] = [];

    await muirProteusMswInstall(
      sets([], [], ['MuirProteusMswOne']),
      undefined,
      async () => instrumenter,
      (message) => warnings.push(message),
      silent,
    );

    assert.deepEqual(warnings, [
      '@muirjs/proteus-msw was tested with @stryker-mutator/instrumenter 10.1.1, not 10.2.0 in ' +
        '/stryker/instrumenter; its self-check passed.',
    ]);
  });
});

describe('resolveFromCore against a fake instrumenter', () => {
  /** A core whose instrumenter resolves a `@babel/core` that has no Babel types members. */
  function fakeCore(t: TestContext) {
    const modules = join(muirTempRoot(t, 'msw-mutators-core-'), 'node_modules');

    muirWriteTree(modules, {
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
      '@babel/core/index.js': 'export const types = {};',
    });

    return {
      corePackage: join(modules, '@stryker-mutator', 'core', 'package.json'),
      dir: join(modules, '@stryker-mutator', 'instrumenter'),
    };
  }

  it('throws, listing every Babel types member that is missing', async (t) => {
    const { corePackage, dir } = fakeCore(t);

    await assert.rejects(muirProteusMswResolveFromCore(corePackage), {
      message:
        `@muirjs/proteus-msw: the instrumenter 9.9.8 in ${dir} has no Babel types with arrayExpression, ` +
        'callExpression, cloneNode, identifier, memberExpression, nullLiteral, objectExpression, stringLiteral.',
    });
  });
});
