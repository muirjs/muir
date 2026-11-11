import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { install } from '../src/install.ts';
import {
  builtIns,
  fakeInstrumenter,
  ownMark,
  sets,
} from './support/fake-instrumenter.ts';

const silent = (): undefined => undefined;

describe('install', () => {
  it("appends the experimental mutators that experimental turns on after Stryker's built-ins, marked", async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await install(
      sets([], [], ['LzOne']),
      { experimental: true },
      async () => instrumenter,
      silent,
      silent,
    );

    assert.deepEqual(names(), [...builtIns, 'LzOne']);
    assert.deepEqual(
      instrumenter.allMutators.map((listed) => ownMark in listed),
      [false, false, true],
    );
  });

  it('installs no experimental mutator without options', async () => {
    const { instrumenter, names } = fakeInstrumenter();

    await install(
      sets([], [], ['LzOne']),
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

    await install(
      sets([], [], ['LzOne', 'LzTwo']),
      undefined,
      async () => instrumenter,
      silent,
      (message) => lines.push(message),
    );

    assert.deepEqual(lines, [
      "@layzee/stryker-msw-mutators: 0 LzMsw mutators on, beside Stryker's built-in mutators. LzOne, LzTwo " +
        'are experimental: lzMswMutators({ experimental: true }) turns them on.',
    ]);
  });

  it('names the experimental mutators that are on in the start line, in roster order', async () => {
    const { instrumenter } = fakeInstrumenter();
    const lines: string[] = [];

    await install(
      sets([], [], ['LzOne', 'LzTwo']),
      { experimental: true },
      async () => instrumenter,
      silent,
      (message) => lines.push(message),
    );

    assert.deepEqual(lines, [
      "@layzee/stryker-msw-mutators: 2 LzMsw mutators on, beside Stryker's built-in mutators. " +
        'Experimental: LzOne, LzTwo.',
    ]);
  });

  it('only counts the mutators on in the start line when all of them run by default', async () => {
    const { instrumenter } = fakeInstrumenter();
    const lines: string[] = [];

    await install(
      sets(['LzOne'], [], ['LzTwo']),
      undefined,
      async () => instrumenter,
      silent,
      (message) => lines.push(message),
    );

    assert.deepEqual(lines, [
      "@layzee/stryker-msw-mutators: 1 LzMsw mutators on, beside Stryker's built-in mutators.",
    ]);
  });

  it('throws when a mutator makes no mutant of its sample, and leaves the list as it was', async () => {
    const { instrumenter, names } = fakeInstrumenter({ silent: ['LzTwo'] });

    await assert.rejects(
      install(
        sets([], [], ['LzOne', 'LzTwo']),
        { experimental: true },
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
        sets([], [], ['Objectliteral']),
        { experimental: true },
        async () => instrumenter,
        silent,
        silent,
      ),
      {
        message:
          '@layzee/stryker-msw-mutators: another mutator already has the name Objectliteral.',
      },
    );
  });

  it('warns about an instrumenter version it was not tested with', async () => {
    const { instrumenter } = fakeInstrumenter({ version: '10.2.0' });
    const warnings: string[] = [];

    await install(
      sets([], [], ['LzOne']),
      undefined,
      async () => instrumenter,
      (message) => warnings.push(message),
      silent,
    );

    assert.deepEqual(warnings, [
      '@layzee/stryker-msw-mutators was tested with @stryker-mutator/instrumenter 10.1.1, not 10.2.0 in ' +
        '/stryker/instrumenter; its self-check passed.',
    ]);
  });
});
