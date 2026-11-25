import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  muirMoiraMutatorsSelectMutators,
  type MuirMoiraMutatorsMutatorOptions,
  type MuirMoiraMutatorsMutatorSets,
} from '../src/select.ts';

const packageName = '@muirjs/test-mutators';
const installName = 'muirMoiraMutatorsTestMutators';
const named = (name: string) => ({ name });
const sets: MuirMoiraMutatorsMutatorSets<{ readonly name: string }> = {
  defaults: [
    named('MuirMoiraMutatorsDefaultA'),
    named('MuirMoiraMutatorsDefaultB'),
  ],
  optIn: [named('MuirMoiraMutatorsOptInA'), named('MuirMoiraMutatorsOptInB')],
  experimental: [
    named('MuirMoiraMutatorsExperimentalA'),
    named('MuirMoiraMutatorsExperimentalB'),
  ],
};
const select = (options: unknown) =>
  muirMoiraMutatorsSelectMutators(packageName, installName, sets, options);
const inheriting = (prototype: object): unknown => Object.create(prototype);

describe('selectMutators', () => {
  it('selects the defaults when there are no options', () => {
    assert.deepEqual(select(undefined), sets.defaults);
  });

  it('adds every opt-in mutator with extended, in roster order', () => {
    assert.deepEqual(select({ extended: true }), [
      ...sets.defaults,
      ...sets.optIn,
    ]);
  });

  it('adds an opt-in mutator turned on by its name', () => {
    assert.deepEqual(select({ MuirMoiraMutatorsOptInB: true }), [
      ...sets.defaults,
      named('MuirMoiraMutatorsOptInB'),
    ]);
  });

  it('rejects a value other than true', () => {
    assert.throws(() => select({ MuirMoiraMutatorsOptInA: false }), {
      message:
        "@muirjs/test-mutators: MuirMoiraMutatorsOptInA takes only true, not false; Stryker's mutator.excludedMutations turns " +
        'mutators off.',
    });
  });

  it('rejects an unknown name, listing the opt-in names', () => {
    assert.throws(() => select({ MuirMoiraMutatorsOptInC: true }), {
      message:
        '@muirjs/test-mutators: no opt-in mutator is named MuirMoiraMutatorsOptInC; the names are MuirMoiraMutatorsOptInA, MuirMoiraMutatorsOptInB.',
    });
  });

  it("rejects a default mutator's name, as it runs by default", () => {
    assert.throws(() => select({ MuirMoiraMutatorsDefaultA: true }), {
      message:
        '@muirjs/test-mutators: no opt-in mutator is named MuirMoiraMutatorsDefaultA; it runs by default.',
    });
  });

  it('adds every experimental mutator with experimental: true', () => {
    assert.deepEqual(select({ experimental: true }), [
      ...sets.defaults,
      ...sets.experimental,
    ]);
  });

  it('adds an experimental mutator turned on by its name inside experimental', () => {
    assert.deepEqual(
      select({ experimental: { MuirMoiraMutatorsExperimentalB: true } }),
      [...sets.defaults, named('MuirMoiraMutatorsExperimentalB')],
    );
  });

  it('rejects an experimental name outside experimental', () => {
    assert.throws(() => select({ MuirMoiraMutatorsExperimentalA: true }), {
      message:
        '@muirjs/test-mutators: no opt-in mutator is named MuirMoiraMutatorsExperimentalA; it is experimental, so it goes inside ' +
        'experimental.',
    });
  });

  it('rejects an opt-in name inside experimental', () => {
    assert.throws(
      () => select({ experimental: { MuirMoiraMutatorsOptInA: true } }),
      {
        message:
          '@muirjs/test-mutators: no experimental mutator is named MuirMoiraMutatorsOptInA; it is opt-in, so it goes outside ' +
          'experimental.',
      },
    );
  });

  it('rejects an unknown name inside experimental, listing the experimental names', () => {
    assert.throws(
      () => select({ experimental: { MuirMoiraMutatorsExperimentalC: true } }),
      {
        message:
          '@muirjs/test-mutators: no experimental mutator is named MuirMoiraMutatorsExperimentalC; the names are MuirMoiraMutatorsExperimentalA, ' +
          'MuirMoiraMutatorsExperimentalB.',
      },
    );
  });

  it('rejects a value other than true inside experimental', () => {
    assert.throws(
      () => select({ experimental: { MuirMoiraMutatorsExperimentalA: 1 } }),
      {
        message:
          "@muirjs/test-mutators: experimental.MuirMoiraMutatorsExperimentalA takes only true, not 1; Stryker's " +
          'mutator.excludedMutations turns mutators off.',
      },
    );
  });

  it('rejects experimental when the package has no experimental mutators', () => {
    assert.throws(
      () =>
        muirMoiraMutatorsSelectMutators(
          packageName,
          installName,
          { ...sets, experimental: [] },
          { experimental: true },
        ),
      {
        message:
          '@muirjs/test-mutators: the package has no experimental mutators yet, so muirMoiraMutatorsTestMutators() takes no ' +
          'experimental option.',
      },
    );
  });

  it('rejects extended when the package has no opt-in mutators', () => {
    assert.throws(
      () =>
        muirMoiraMutatorsSelectMutators(
          packageName,
          installName,
          { ...sets, optIn: [] },
          { extended: true },
        ),
      {
        message:
          '@muirjs/test-mutators: the package has no opt-in mutators yet, so muirMoiraMutatorsTestMutators() takes no ' +
          'extended option.',
      },
    );
  });

  // The typecheck runs these: each const's type is false or true by the options type, so a wrong type fails to compile.
  it('types extended and experimental for a package with both tiers', () => {
    const experimentalWithTier: 'experimental' extends keyof MuirMoiraMutatorsMutatorOptions<
      'MuirMoiraMutatorsOptInA',
      'MuirMoiraMutatorsExperimentalA'
    >
      ? true
      : false = true;
    const extendedWithTier: 'extended' extends keyof MuirMoiraMutatorsMutatorOptions<
      'MuirMoiraMutatorsOptInA',
      'MuirMoiraMutatorsExperimentalA'
    >
      ? true
      : false = true;

    assert.deepEqual([experimentalWithTier, extendedWithTier], [true, true]);
  });

  it('types no key for a tier that has no mutators, as the install rejects it', () => {
    const experimentalWithoutTier: 'experimental' extends keyof MuirMoiraMutatorsMutatorOptions<
      'MuirMoiraMutatorsOptInA',
      never
    >
      ? true
      : false = false;
    const extendedWithoutTier: 'extended' extends keyof MuirMoiraMutatorsMutatorOptions<
      never,
      'MuirMoiraMutatorsExperimentalA'
    >
      ? true
      : false = false;
    const onlyUndefinedWithoutTiers: MuirMoiraMutatorsMutatorOptions<
      never,
      never
    >['experimental'] extends undefined
      ? true
      : false = true;

    assert.deepEqual(
      [experimentalWithoutTier, extendedWithoutTier, onlyUndefinedWithoutTiers],
      [false, false, true],
    );
  });

  it('rejects options that are not an object', () => {
    assert.throws(() => select('extended'), {
      message:
        "@muirjs/test-mutators: the options must be a plain object, not 'extended'.",
    });
  });

  for (const [title, experimental, shown] of [
    [
      'an array',
      ['MuirMoiraMutatorsExperimentalA'],
      "[ 'MuirMoiraMutatorsExperimentalA' ]",
    ],
    [
      'an object whose names it inherits',
      inheriting({ MuirMoiraMutatorsExperimentalA: true }),
      '{}',
    ],
  ] as const) {
    it(`rejects ${title} as the value of experimental`, () => {
      assert.throws(() => select({ experimental }), {
        message:
          `@muirjs/test-mutators: experimental takes only true, not ${shown}; Stryker's ` +
          'mutator.excludedMutations turns mutators off.',
      });
    });
  }

  it('selects by the keys the options own, not by keys on Object.prototype', () => {
    const inherited = [
      'extended',
      'MuirMoiraMutatorsOptInA',
      'MuirMoiraMutatorsExperimentalA',
    ];

    for (const key of inherited) {
      Object.defineProperty(Object.prototype, key, {
        value: true,
        configurable: true,
      });
    }

    try {
      assert.deepEqual(select({ experimental: {} }), sets.defaults);
    } finally {
      for (const key of inherited) {
        Reflect.deleteProperty(Object.prototype, key);
      }
    }
  });

  it('neither checks nor reads an own key that is not enumerable', () => {
    const options = Object.defineProperties(
      {},
      { extended: { value: true }, MuirMoiraMutatorsNoSuch: { value: 'yes' } },
    );

    assert.deepEqual(select(options), sets.defaults);
  });

  it('takes options without a prototype', () => {
    const options: unknown = Object.assign(Object.create(null), {
      extended: true,
    });

    assert.deepEqual(select(options), [...sets.defaults, ...sets.optIn]);
  });

  for (const [title, options, shown] of [
    ['null', null, 'null'],
    ['a Map', new Map([['extended', true]]), "Map(1) { 'extended' => true }"],
    ['a Date', new Date(0), '1970-01-01T00:00:00.000Z'],
    [
      'an object whose keys it inherits',
      inheriting({ MuirMoiraMutatorsOptInB: true, experimental: true }),
      '{}',
    ],
  ] as const) {
    it(`rejects ${title} as the options`, () => {
      assert.throws(() => select(options), {
        message: `@muirjs/test-mutators: the options must be a plain object, not ${shown}.`,
      });
    });
  }

  it('lists none when an opt-in name is given and the package has no opt-in mutators', () => {
    assert.throws(
      () =>
        muirMoiraMutatorsSelectMutators(
          packageName,
          installName,
          { ...sets, optIn: [] },
          { MuirMoiraMutatorsOptInA: true },
        ),
      {
        message:
          '@muirjs/test-mutators: no opt-in mutator is named MuirMoiraMutatorsOptInA; the names are none.',
      },
    );
  });

  it('rejects an array as the options', () => {
    assert.throws(() => select(['extended']), {
      message:
        "@muirjs/test-mutators: the options must be a plain object, not [ 'extended' ].",
    });
    assert.throws(() => select([]), {
      message:
        '@muirjs/test-mutators: the options must be a plain object, not [].',
    });
  });

  it('selects an opt-in name when the package has no experimental mutators', () => {
    assert.deepEqual(
      muirMoiraMutatorsSelectMutators(
        packageName,
        installName,
        { ...sets, experimental: [] },
        { MuirMoiraMutatorsOptInA: true },
      ),
      [...sets.defaults, sets.optIn[0]],
    );
  });

  it('rejects an object as the value of an opt-in name', () => {
    assert.throws(
      () =>
        select({
          MuirMoiraMutatorsOptInA: { MuirMoiraMutatorsExperimentalA: true },
        }),
      {
        message:
          "@muirjs/test-mutators: MuirMoiraMutatorsOptInA takes only true, not { MuirMoiraMutatorsExperimentalA: true }; Stryker's " +
          'mutator.excludedMutations turns mutators off.',
      },
    );
  });

  it('rejects false as the value of extended', () => {
    assert.throws(() => select({ extended: false }), {
      message:
        "@muirjs/test-mutators: extended takes only true, not false; Stryker's " +
        'mutator.excludedMutations turns mutators off.',
    });
  });

  it('rejects false as the value of experimental', () => {
    assert.throws(() => select({ experimental: false }), {
      message:
        "@muirjs/test-mutators: experimental takes only true, not false; Stryker's " +
        'mutator.excludedMutations turns mutators off.',
    });
  });

  describe('when the package has no opt-in or experimental mutators', () => {
    const defaultsOnly = { ...sets, optIn: [], experimental: [] };
    const noOptions =
      '@muirjs/test-mutators: the package has no opt-in or experimental mutators yet, so muirMoiraMutatorsTestMutators() takes ' +
      'no options. Turn a mutator off with mutator.excludedMutations.';

    it('rejects an options key', () => {
      assert.throws(
        () =>
          muirMoiraMutatorsSelectMutators(
            packageName,
            installName,
            defaultsOnly,
            {
              extended: true,
            },
          ),
        { message: noOptions },
      );
    });

    it('selects the defaults when there are no options', () => {
      assert.deepEqual(
        muirMoiraMutatorsSelectMutators(
          packageName,
          installName,
          defaultsOnly,
          undefined,
        ),
        sets.defaults,
      );
    });

    it('rejects an options key next to one that holds undefined', () => {
      assert.throws(
        () =>
          muirMoiraMutatorsSelectMutators(
            packageName,
            installName,
            defaultsOnly,
            {
              extended: undefined,
              MuirMoiraMutatorsOptInA: true,
            },
          ),
        { message: noOptions },
      );
    });

    it('treats an options key that holds undefined as absent', () => {
      assert.deepEqual(
        muirMoiraMutatorsSelectMutators(
          packageName,
          installName,
          defaultsOnly,
          {
            extended: undefined,
          },
        ),
        sets.defaults,
      );
    });
  });
});
