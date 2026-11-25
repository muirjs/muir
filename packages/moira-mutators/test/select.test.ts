import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  selectMutators,
  type MutatorOptions,
  type MutatorSets,
} from '../src/select.ts';

const packageName = '@muirjs/test-mutators';
const installName = 'lzTestMutators';
const named = (name: string) => ({ name });
const sets: MutatorSets<{ readonly name: string }> = {
  defaults: [named('LzDefaultA'), named('LzDefaultB')],
  optIn: [named('LzOptInA'), named('LzOptInB')],
  experimental: [named('LzExperimentalA'), named('LzExperimentalB')],
};
const select = (options: unknown) =>
  selectMutators(packageName, installName, sets, options);
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
    assert.deepEqual(select({ LzOptInB: true }), [
      ...sets.defaults,
      named('LzOptInB'),
    ]);
  });

  it('rejects a value other than true', () => {
    assert.throws(() => select({ LzOptInA: false }), {
      message:
        "@muirjs/test-mutators: LzOptInA takes only true, not false; Stryker's mutator.excludedMutations turns " +
        'mutators off.',
    });
  });

  it('rejects an unknown name, listing the opt-in names', () => {
    assert.throws(() => select({ LzOptInC: true }), {
      message:
        '@muirjs/test-mutators: no opt-in mutator is named LzOptInC; the names are LzOptInA, LzOptInB.',
    });
  });

  it("rejects a default mutator's name, as it runs by default", () => {
    assert.throws(() => select({ LzDefaultA: true }), {
      message:
        '@muirjs/test-mutators: no opt-in mutator is named LzDefaultA; it runs by default.',
    });
  });

  it('adds every experimental mutator with experimental: true', () => {
    assert.deepEqual(select({ experimental: true }), [
      ...sets.defaults,
      ...sets.experimental,
    ]);
  });

  it('adds an experimental mutator turned on by its name inside experimental', () => {
    assert.deepEqual(select({ experimental: { LzExperimentalB: true } }), [
      ...sets.defaults,
      named('LzExperimentalB'),
    ]);
  });

  it('rejects an experimental name outside experimental', () => {
    assert.throws(() => select({ LzExperimentalA: true }), {
      message:
        '@muirjs/test-mutators: no opt-in mutator is named LzExperimentalA; it is experimental, so it goes inside ' +
        'experimental.',
    });
  });

  it('rejects an opt-in name inside experimental', () => {
    assert.throws(() => select({ experimental: { LzOptInA: true } }), {
      message:
        '@muirjs/test-mutators: no experimental mutator is named LzOptInA; it is opt-in, so it goes outside ' +
        'experimental.',
    });
  });

  it('rejects an unknown name inside experimental, listing the experimental names', () => {
    assert.throws(() => select({ experimental: { LzExperimentalC: true } }), {
      message:
        '@muirjs/test-mutators: no experimental mutator is named LzExperimentalC; the names are LzExperimentalA, ' +
        'LzExperimentalB.',
    });
  });

  it('rejects a value other than true inside experimental', () => {
    assert.throws(() => select({ experimental: { LzExperimentalA: 1 } }), {
      message:
        "@muirjs/test-mutators: experimental.LzExperimentalA takes only true, not 1; Stryker's " +
        'mutator.excludedMutations turns mutators off.',
    });
  });

  it('rejects experimental when the package has no experimental mutators', () => {
    assert.throws(
      () =>
        selectMutators(
          packageName,
          installName,
          { ...sets, experimental: [] },
          { experimental: true },
        ),
      {
        message:
          '@muirjs/test-mutators: the package has no experimental mutators yet, so lzTestMutators() takes no ' +
          'experimental option.',
      },
    );
  });

  it('rejects extended when the package has no opt-in mutators', () => {
    assert.throws(
      () =>
        selectMutators(
          packageName,
          installName,
          { ...sets, optIn: [] },
          { extended: true },
        ),
      {
        message:
          '@muirjs/test-mutators: the package has no opt-in mutators yet, so lzTestMutators() takes no ' +
          'extended option.',
      },
    );
  });

  // The typecheck runs these: each const's type is false or true by the options type, so a wrong type fails to compile.
  it('types extended and experimental for a package with both tiers', () => {
    const experimentalWithTier: 'experimental' extends keyof MutatorOptions<
      'LzOptInA',
      'LzExperimentalA'
    >
      ? true
      : false = true;
    const extendedWithTier: 'extended' extends keyof MutatorOptions<
      'LzOptInA',
      'LzExperimentalA'
    >
      ? true
      : false = true;

    assert.deepEqual([experimentalWithTier, extendedWithTier], [true, true]);
  });

  it('types no key for a tier that has no mutators, as the install rejects it', () => {
    const experimentalWithoutTier: 'experimental' extends keyof MutatorOptions<
      'LzOptInA',
      never
    >
      ? true
      : false = false;
    const extendedWithoutTier: 'extended' extends keyof MutatorOptions<
      never,
      'LzExperimentalA'
    >
      ? true
      : false = false;
    const onlyUndefinedWithoutTiers: MutatorOptions<
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
    ['an array', ['LzExperimentalA'], "[ 'LzExperimentalA' ]"],
    [
      'an object whose names it inherits',
      inheriting({ LzExperimentalA: true }),
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
    const inherited = ['extended', 'LzOptInA', 'LzExperimentalA'];

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
      { extended: { value: true }, LzNoSuch: { value: 'yes' } },
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
      inheriting({ LzOptInB: true, experimental: true }),
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
        selectMutators(
          packageName,
          installName,
          { ...sets, optIn: [] },
          { LzOptInA: true },
        ),
      {
        message:
          '@muirjs/test-mutators: no opt-in mutator is named LzOptInA; the names are none.',
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
      selectMutators(
        packageName,
        installName,
        { ...sets, experimental: [] },
        { LzOptInA: true },
      ),
      [...sets.defaults, sets.optIn[0]],
    );
  });

  it('rejects an object as the value of an opt-in name', () => {
    assert.throws(() => select({ LzOptInA: { LzExperimentalA: true } }), {
      message:
        "@muirjs/test-mutators: LzOptInA takes only true, not { LzExperimentalA: true }; Stryker's " +
        'mutator.excludedMutations turns mutators off.',
    });
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
      '@muirjs/test-mutators: the package has no opt-in or experimental mutators yet, so lzTestMutators() takes ' +
      'no options. Turn a mutator off with mutator.excludedMutations.';

    it('rejects an options key', () => {
      assert.throws(
        () =>
          selectMutators(packageName, installName, defaultsOnly, {
            extended: true,
          }),
        { message: noOptions },
      );
    });

    it('selects the defaults when there are no options', () => {
      assert.deepEqual(
        selectMutators(packageName, installName, defaultsOnly, undefined),
        sets.defaults,
      );
    });

    it('rejects an options key next to one that holds undefined', () => {
      assert.throws(
        () =>
          selectMutators(packageName, installName, defaultsOnly, {
            extended: undefined,
            LzOptInA: true,
          }),
        { message: noOptions },
      );
    });

    it('treats an options key that holds undefined as absent', () => {
      assert.deepEqual(
        selectMutators(packageName, installName, defaultsOnly, {
          extended: undefined,
        }),
        sets.defaults,
      );
    });
  });
});
