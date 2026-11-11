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
          '@layzee/stryker-storybook-mutators: the package has no opt-in or experimental mutators yet, so ' +
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
          '@layzee/stryker-storybook-mutators: another mutator already has the name Objectliteral.',
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
      '@layzee/stryker-storybook-mutators was tested with @stryker-mutator/instrumenter 10.1.1, not 10.2.0 in ' +
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
      "@layzee/stryker-storybook-mutators: 2 LzStorybook mutators on, beside Stryker's built-in mutators.",
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
      "@layzee/stryker-storybook-mutators: 3 LzStorybook mutators on, beside Stryker's built-in mutators. " +
        'Opt-in or experimental: LzThree, LzFour.',
    ]);
  });
});
