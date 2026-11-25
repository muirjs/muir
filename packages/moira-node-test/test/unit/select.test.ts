import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { muirTestEach } from '@muirjs/madrox-node-test';
import type { MuirMoiraNodeTestMutator } from '../../src/mutator.ts';
import {
  muirMoiraNodeTestAllMutators,
  muirMoiraNodeTestSelectMutators,
  type MuirMoiraNodeTestMutatorSets,
} from '../../src/select.ts';

const packageName = 'muir-sample-mutators';

function mutator(name: string): MuirMoiraNodeTestMutator {
  return { name, sample: `${name}();`, *mutate() {} };
}

const sets: MuirMoiraNodeTestMutatorSets = {
  defaults: [
    mutator('MuirMoiraNodeTestDefaultA'),
    mutator('MuirMoiraNodeTestDefaultB'),
  ],
  optIn: [
    mutator('MuirMoiraNodeTestOptInA'),
    mutator('MuirMoiraNodeTestOptInB'),
  ],
  experimental: [
    mutator('MuirMoiraNodeTestExperimentalA'),
    mutator('MuirMoiraNodeTestExperimentalB'),
  ],
};

function namesFor(options: unknown): string[] {
  return muirMoiraNodeTestSelectMutators(packageName, sets, options).map(
    ({ name }) => name,
  );
}

describe('muirMoiraNodeTestSelectMutators', () => {
  muirTestEach([
    [
      'no options',
      undefined,
      ['MuirMoiraNodeTestDefaultA', 'MuirMoiraNodeTestDefaultB'],
    ],
    [
      'empty options',
      {},
      ['MuirMoiraNodeTestDefaultA', 'MuirMoiraNodeTestDefaultB'],
    ],
    [
      'every opt-in mutator',
      { extended: true },
      [
        'MuirMoiraNodeTestDefaultA',
        'MuirMoiraNodeTestDefaultB',
        'MuirMoiraNodeTestOptInA',
        'MuirMoiraNodeTestOptInB',
      ],
    ],
    [
      'an opt-in mutator by name',
      { MuirMoiraNodeTestOptInB: true },
      [
        'MuirMoiraNodeTestDefaultA',
        'MuirMoiraNodeTestDefaultB',
        'MuirMoiraNodeTestOptInB',
      ],
    ],
    [
      'every opt-in mutator and one by name',
      { MuirMoiraNodeTestOptInB: true, extended: true },
      [
        'MuirMoiraNodeTestDefaultA',
        'MuirMoiraNodeTestDefaultB',
        'MuirMoiraNodeTestOptInA',
        'MuirMoiraNodeTestOptInB',
      ],
    ],
    [
      'every experimental mutator',
      { experimental: true },
      [
        'MuirMoiraNodeTestDefaultA',
        'MuirMoiraNodeTestDefaultB',
        'MuirMoiraNodeTestExperimentalA',
        'MuirMoiraNodeTestExperimentalB',
      ],
    ],
    [
      'an experimental mutator by name',
      { experimental: { MuirMoiraNodeTestExperimentalB: true } },
      [
        'MuirMoiraNodeTestDefaultA',
        'MuirMoiraNodeTestDefaultB',
        'MuirMoiraNodeTestExperimentalB',
      ],
    ],
    [
      'no experimental mutator by name',
      { experimental: {} },
      ['MuirMoiraNodeTestDefaultA', 'MuirMoiraNodeTestDefaultB'],
    ],
    [
      'no mutator for options left undefined',
      {
        MuirMoiraNodeTestOptInA: undefined,
        extended: undefined,
        experimental: { MuirMoiraNodeTestExperimentalA: undefined },
      },
      ['MuirMoiraNodeTestDefaultA', 'MuirMoiraNodeTestDefaultB'],
    ],
    [
      'no experimental mutator for experimental left undefined',
      { experimental: undefined },
      ['MuirMoiraNodeTestDefaultA', 'MuirMoiraNodeTestDefaultB'],
    ],
    [
      'opt-in and experimental mutators, in the order of the sets',
      {
        experimental: { MuirMoiraNodeTestExperimentalB: true },
        MuirMoiraNodeTestOptInB: true,
        extended: true,
      },
      [
        'MuirMoiraNodeTestDefaultA',
        'MuirMoiraNodeTestDefaultB',
        'MuirMoiraNodeTestOptInA',
        'MuirMoiraNodeTestOptInB',
        'MuirMoiraNodeTestExperimentalB',
      ],
    ],
  ])('installs the defaults and %s', (_title, options, expected) => {
    assert.deepEqual(namesFor(options), expected);
  });

  muirTestEach([
    [
      'options that are not an object',
      'extended',
      "muir-sample-mutators: the options must be an object, not 'extended'.",
    ],
    [
      'options that are an array',
      ['MuirMoiraNodeTestOptInA'],
      "muir-sample-mutators: the options must be an object, not [ 'MuirMoiraNodeTestOptInA' ].",
    ],
    [
      'a value JSON cannot print',
      { MuirMoiraNodeTestOptInA: 1n },
      "muir-sample-mutators: MuirMoiraNodeTestOptInA takes only true, not 1n; Stryker's mutator.excludedMutations turns mutators off.",
    ],
    [
      'false for a mutator',
      { MuirMoiraNodeTestOptInA: false },
      "muir-sample-mutators: MuirMoiraNodeTestOptInA takes only true, not false; Stryker's mutator.excludedMutations turns mutators off.",
    ],
    [
      'an object for a mutator',
      { MuirMoiraNodeTestOptInA: { MuirMoiraNodeTestExperimentalA: true } },
      'muir-sample-mutators: MuirMoiraNodeTestOptInA takes only true, not { MuirMoiraNodeTestExperimentalA: true }; ' +
        "Stryker's mutator.excludedMutations turns mutators off.",
    ],
    [
      'false for every opt-in mutator',
      { extended: false },
      "muir-sample-mutators: extended takes only true, not false; Stryker's mutator.excludedMutations turns mutators off.",
    ],
    [
      'false for an experimental mutator',
      { experimental: { MuirMoiraNodeTestExperimentalA: false } },
      'muir-sample-mutators: experimental.MuirMoiraNodeTestExperimentalA takes only true, not false; ' +
        "Stryker's mutator.excludedMutations turns mutators off.",
    ],
    [
      'false for every experimental mutator',
      { experimental: false },
      'muir-sample-mutators: experimental takes only true or an object of names, not false; ' +
        "Stryker's mutator.excludedMutations turns mutators off.",
    ],
    [
      'an array of experimental names',
      { experimental: ['MuirMoiraNodeTestExperimentalA'] },
      "muir-sample-mutators: experimental takes only true or an object of names, not [ 'MuirMoiraNodeTestExperimentalA' ]; " +
        "Stryker's mutator.excludedMutations turns mutators off.",
    ],
    [
      'an unknown name',
      { MuirMoiraNodeTestOptInC: true },
      'muir-sample-mutators: no opt-in mutator is named MuirMoiraNodeTestOptInC; the names are MuirMoiraNodeTestOptInA, MuirMoiraNodeTestOptInB.',
    ],
    [
      'an unknown experimental name',
      { experimental: { MuirMoiraNodeTestExperimentalC: true } },
      'muir-sample-mutators: no experimental mutator is named MuirMoiraNodeTestExperimentalC; the names are MuirMoiraNodeTestExperimentalA, MuirMoiraNodeTestExperimentalB.',
    ],
    [
      'a default mutator by name',
      { MuirMoiraNodeTestDefaultA: true },
      'muir-sample-mutators: no opt-in mutator is named MuirMoiraNodeTestDefaultA; it runs by default.',
    ],
    [
      'an experimental mutator outside experimental',
      { MuirMoiraNodeTestExperimentalA: true },
      'muir-sample-mutators: no opt-in mutator is named MuirMoiraNodeTestExperimentalA; it is experimental, so it goes inside experimental.',
    ],
    [
      'an opt-in mutator inside experimental',
      { experimental: { MuirMoiraNodeTestOptInA: true } },
      'muir-sample-mutators: no experimental mutator is named MuirMoiraNodeTestOptInA; it is opt-in, so it goes outside experimental.',
    ],
  ])('throws on %s', (_title, options, message) => {
    assert.throws(() => namesFor(options), { message });
  });

  it('lists every mutator, the defaults first', () => {
    assert.deepEqual(
      muirMoiraNodeTestAllMutators(sets).map(({ name }) => name),
      [
        'MuirMoiraNodeTestDefaultA',
        'MuirMoiraNodeTestDefaultB',
        'MuirMoiraNodeTestOptInA',
        'MuirMoiraNodeTestOptInB',
        'MuirMoiraNodeTestExperimentalA',
        'MuirMoiraNodeTestExperimentalB',
      ],
    );
  });

  it('names no mutators when a set is empty', () => {
    assert.throws(
      () =>
        muirMoiraNodeTestSelectMutators(
          packageName,
          { ...sets, experimental: [] },
          { experimental: { MuirMoiraNodeTestX: true } },
        ),
      {
        message:
          'muir-sample-mutators: no experimental mutator is named MuirMoiraNodeTestX; the names are none.',
      },
    );
  });
});
