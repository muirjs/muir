import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  MuirMoiraMutatorsCheckedInstrumenter,
  MuirMoiraMutatorsListedMutator,
  MuirMoiraMutatorsMutantOrigin,
  MuirMoiraMutatorsSourceFile,
} from '../src/instrumenter.ts';
import {
  muirMoiraMutatorsCheckNames,
  muirMoiraMutatorsIsSelfCheckFile,
  muirMoiraMutatorsMarkOf,
  muirMoiraMutatorsRegister,
  muirMoiraMutatorsSelfCheck,
  muirMoiraMutatorsSelfCheckFile,
  muirMoiraMutatorsUndoOnThrow,
  muirMoiraMutatorsWarnUntested,
} from '../src/install.ts';

const packageName = '@muirjs/test-mutators';
const listed = (name: string): MuirMoiraMutatorsListedMutator => ({
  name,
  mutate: () => undefined,
});
const named = (...names: string[]) => names.map((name) => ({ name }));

describe('markOf', () => {
  it('is the symbol registered under the package name', () => {
    assert.equal(muirMoiraMutatorsMarkOf(packageName), Symbol.for(packageName));
  });
});

describe('checkNames', () => {
  it('accepts names of letters that no other mutator has', () => {
    assert.doesNotThrow(() =>
      muirMoiraMutatorsCheckNames(
        packageName,
        named('MuirMoiraMutatorsOne', 'MuirMoiraMutatorsTwo'),
        [listed('Regex')],
      ),
    );
  });

  it('lists each name with another character than a letter, in order', () => {
    assert.throws(
      () =>
        muirMoiraMutatorsCheckNames(
          packageName,
          named('Text1', 'Good', 'Text-Literal', ''),
          [],
        ),
      {
        message:
          "@muirjs/test-mutators: a mutator name has letters only, as Stryker's directives match no other " +
          'character: "Text1", "Text-Literal", ""',
      },
    );
  });

  it('rejects a name that another mutator has, ignoring case', () => {
    assert.throws(
      () =>
        muirMoiraMutatorsCheckNames(
          packageName,
          named('MuirMoiraMutatorsOne', 'regex'),
          [listed('Regex')],
        ),
      {
        message:
          '@muirjs/test-mutators: another mutator already has the name regex.',
      },
    );
  });

  it('lists every taken name, in order', () => {
    assert.throws(
      () =>
        muirMoiraMutatorsCheckNames(
          packageName,
          named('Regex', 'Free', 'ObjectLiteral'),
          [listed('ObjectLiteral'), listed('Regex')],
        ),
      {
        message:
          '@muirjs/test-mutators: another mutator already has the name Regex, ObjectLiteral.',
      },
    );
  });

  it('rejects the second of two names that differ only in case', () => {
    assert.throws(
      () =>
        muirMoiraMutatorsCheckNames(
          packageName,
          named('MuirMoiraMutatorsOne', 'muirmoiramutatorsone'),
          [],
        ),
      {
        message:
          '@muirjs/test-mutators: another mutator already has the name muirmoiramutatorsone.',
      },
    );
  });

  it('accepts a name that an entry of the package itself holds', () => {
    const own = {
      ...listed('MuirMoiraMutatorsOne'),
      [muirMoiraMutatorsMarkOf(packageName)]: 1,
    };
    const foreign = {
      ...listed('MuirMoiraMutatorsTwo'),
      [muirMoiraMutatorsMarkOf('@muirjs/other-mutators')]: 1,
    };

    assert.doesNotThrow(() =>
      muirMoiraMutatorsCheckNames(packageName, named('MuirMoiraMutatorsOne'), [
        own,
        foreign,
      ]),
    );
    assert.throws(() =>
      muirMoiraMutatorsCheckNames(packageName, named('MuirMoiraMutatorsTwo'), [
        own,
        foreign,
      ]),
    );
  });
});

describe('register', () => {
  it('appends the missing mutators, marked as the package own, and keeps the rest', () => {
    const existing = listed('Regex');
    const allMutators: MuirMoiraMutatorsListedMutator[] = [existing];
    const first = listed('MuirMoiraMutatorsOne');
    const second = listed('MuirMoiraMutatorsTwo');

    muirMoiraMutatorsRegister(packageName, allMutators, [first, second]);

    const mark = muirMoiraMutatorsMarkOf(packageName);

    assert.equal(allMutators.length, 3);
    assert.equal(allMutators[0], existing);
    assert.deepEqual(
      allMutators.slice(1).map(({ name }) => name),
      ['MuirMoiraMutatorsOne', 'MuirMoiraMutatorsTwo'],
    );
    assert.equal(allMutators[1]?.mutate, first.mutate);
    assert.equal(Reflect.get(allMutators[1] ?? {}, mark), mark);
    assert.equal(Reflect.get(allMutators[2] ?? {}, mark), mark);
    assert.equal(mark in existing, false);
  });

  it('skips a mutator whose name the list holds already', () => {
    const existing = listed('MuirMoiraMutatorsOne');
    const allMutators: MuirMoiraMutatorsListedMutator[] = [existing];

    muirMoiraMutatorsRegister(packageName, allMutators, [
      listed('MuirMoiraMutatorsOne'),
      listed('MuirMoiraMutatorsTwo'),
    ]);

    assert.deepEqual(
      allMutators.map(({ name }) => name),
      ['MuirMoiraMutatorsOne', 'MuirMoiraMutatorsTwo'],
    );
    assert.equal(allMutators[0], existing);
  });
});

describe('register converges', () => {
  it('replaces the entries of an earlier call with the new selection, in place, and keeps the siblings', () => {
    const builtIn = listed('Regex');
    const foreign = {
      ...listed('MuirMoiraMutatorsForeign'),
      [muirMoiraMutatorsMarkOf('@muirjs/other-mutators')]: 1,
    };
    const allMutators: MuirMoiraMutatorsListedMutator[] = [builtIn];
    const list = allMutators;

    muirMoiraMutatorsRegister(packageName, allMutators, [
      listed('MuirMoiraMutatorsOne'),
      listed('MuirMoiraMutatorsTwo'),
    ]);
    allMutators.splice(1, 0, foreign);
    muirMoiraMutatorsRegister(packageName, allMutators, [
      listed('MuirMoiraMutatorsTwo'),
      listed('MuirMoiraMutatorsThree'),
    ]);

    assert.equal(allMutators, list);
    assert.deepEqual(
      allMutators.map(({ name }) => name),
      [
        'Regex',
        'MuirMoiraMutatorsForeign',
        'MuirMoiraMutatorsTwo',
        'MuirMoiraMutatorsThree',
      ],
    );
    assert.equal(allMutators[0], builtIn);
    assert.equal(allMutators[1], foreign);
  });
});

describe('selfCheck', () => {
  const fakeInstrumenter = (
    mutantsOf: (
      files: readonly MuirMoiraMutatorsSourceFile[],
    ) => readonly MuirMoiraMutatorsMutantOrigin[],
    seen: MuirMoiraMutatorsSourceFile[] = [],
  ): MuirMoiraMutatorsCheckedInstrumenter => ({
    dir: '/fake/instrumenter',
    version: '1.2.3',
    instrument: async (files) => {
      seen.push(...files);

      return mutantsOf(files);
    },
  });
  const samples = [
    { name: 'MuirMoiraMutatorsOne', sample: 'one();' },
    { name: 'MuirMoiraMutatorsTwo', sample: 'two();' },
  ];

  it('passes when every mutator makes a mutant in its own sample file', async () => {
    const seen: MuirMoiraMutatorsSourceFile[] = [];
    const instrumenter = fakeInstrumenter(
      (files) =>
        files.map(({ name }) => ({
          fileName: name,
          mutatorName: name.replace('.self-check.tsx', ''),
        })),
      seen,
    );

    await muirMoiraMutatorsSelfCheck(packageName, instrumenter, samples);

    assert.deepEqual(seen, [
      { name: 'MuirMoiraMutatorsOne.self-check.tsx', content: 'one();' },
      { name: 'MuirMoiraMutatorsTwo.self-check.tsx', content: 'two();' },
    ]);
  });

  it('throws, listing the mutators that made no mutant', async () => {
    const instrumenter = fakeInstrumenter(() => [
      {
        fileName: 'MuirMoiraMutatorsOne.self-check.tsx',
        mutatorName: 'MuirMoiraMutatorsOne',
      },
      { fileName: 'MuirMoiraMutatorsTwo.self-check.tsx', mutatorName: 'Regex' },
      { fileName: 'Other.self-check.tsx', mutatorName: 'MuirMoiraMutatorsTwo' },
    ]);

    await assert.rejects(
      muirMoiraMutatorsSelfCheck(packageName, instrumenter, samples),
      {
        message:
          '@muirjs/test-mutators: the instrumenter 1.2.3 in /fake/instrumenter made no mutants of MuirMoiraMutatorsTwo from their ' +
          'samples, so it does not run the mutators this module added. A bundled or second copy of the instrumenter ' +
          'does that.',
      },
    );
  });

  it('lists every silent mutator, in order', async () => {
    const instrumenter = fakeInstrumenter(() => []);

    await assert.rejects(
      muirMoiraMutatorsSelfCheck(packageName, instrumenter, samples),
      {
        message:
          /made no mutants of MuirMoiraMutatorsOne, MuirMoiraMutatorsTwo from/,
      },
    );
  });
});

describe('isSelfCheckFile', () => {
  it('tells the sample files of the self-check from other files', () => {
    assert.equal(
      muirMoiraMutatorsIsSelfCheckFile(
        muirMoiraMutatorsSelfCheckFile('MuirMoiraMutatorsOne'),
      ),
      true,
    );
    assert.equal(
      muirMoiraMutatorsIsSelfCheckFile(
        'src/MuirMoiraMutatorsOne.self-check.tsx',
      ),
      true,
    );
    assert.equal(
      muirMoiraMutatorsIsSelfCheckFile('src/MuirMoiraMutatorsOne.tsx'),
      false,
    );
  });
});

describe('undoOnThrow', () => {
  const mark = muirMoiraMutatorsMarkOf(packageName);
  const failure = new Error('check failed');

  it('keeps the changes when the change resolves', async () => {
    const list = [listed('Regex')];
    const placer: { [key: symbol]: unknown } = {};

    await muirMoiraMutatorsUndoOnThrow([list, placer], async () => {
      list.push(listed('MuirMoiraMutatorsOne'));
      placer[mark] = mark;
    });

    assert.deepEqual(
      list.map(({ name }) => name),
      ['Regex', 'MuirMoiraMutatorsOne'],
    );
    assert.equal(placer[mark], mark);
  });

  it('rethrows and gives every target back exactly its own properties when the change throws', async () => {
    const regex = listed('Regex');
    const literal = listed('StringLiteral');
    const list = [regex, literal];
    const longer = [regex];
    const canPlace = () => false;
    const placer: {
      name: string;
      canPlace: () => boolean;
      [key: symbol]: unknown;
    } = { name: 'placer', canPlace };

    await assert.rejects(
      muirMoiraMutatorsUndoOnThrow([list, longer, placer], async () => {
        list.splice(0, list.length, listed('MuirMoiraMutatorsOne'));
        longer.push(literal, listed('MuirMoiraMutatorsTwo'));
        placer.canPlace = () => true;
        placer[mark] = mark;
        throw failure;
      }),
      (error) => error === failure,
    );

    assert.deepEqual(list, [regex, literal]);
    assert.deepEqual(longer, [regex]);
    assert.deepEqual(Reflect.ownKeys(placer), ['name', 'canPlace']);
    assert.equal(placer.canPlace, canPlace);
  });
});

describe('warnUntested', () => {
  const instrumenter = { dir: '/fake/instrumenter', version: '1.2.3' };

  it('warns when the instrumenter is not the tested version', () => {
    const warnings: string[] = [];

    muirMoiraMutatorsWarnUntested(
      packageName,
      '1.0.0',
      instrumenter,
      (message) => warnings.push(message),
    );

    assert.deepEqual(warnings, [
      '@muirjs/test-mutators was tested with @stryker-mutator/instrumenter 1.0.0, not 1.2.3 in /fake/instrumenter; ' +
        'its self-check passed.',
    ]);
  });

  it('says nothing when the instrumenter is the tested version', () => {
    const warnings: string[] = [];

    muirMoiraMutatorsWarnUntested(
      packageName,
      '1.2.3',
      instrumenter,
      (message) => warnings.push(message),
    );

    assert.deepEqual(warnings, []);
  });
});
