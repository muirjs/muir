import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  muirMoiraMutatorsBuiltInNames,
  muirMoiraMutatorsBuiltInSample,
  muirMoiraMutatorsCheckBuiltInsRemoved,
  muirMoiraMutatorsRemoveBuiltIns,
} from '../src/built-ins.ts';
import type { MuirMoiraMutatorsListedMutator } from '../src/instrumenter.ts';

const packageName = '@muirjs/test-mutators';
const listed = (name: string): MuirMoiraMutatorsListedMutator => ({
  name,
  mutate: () => undefined,
});
const ignoreWarning = (): undefined => undefined;
const fakeInstrumenter = (allMutators: MuirMoiraMutatorsListedMutator[]) => ({
  dir: '/fake/instrumenter',
  version: '1.2.3',
  allMutators,
});

describe('removeBuiltIns', () => {
  it('removes the 17 built-ins in place and keeps the other entries', () => {
    const own = listed('MuirMoiraMutatorsOwn');
    const allMutators = [
      ...muirMoiraMutatorsBuiltInNames.slice(0, 5).map(listed),
      own,
      ...muirMoiraMutatorsBuiltInNames.slice(5).map(listed),
    ];

    muirMoiraMutatorsRemoveBuiltIns(
      packageName,
      fakeInstrumenter(allMutators),
      ignoreWarning,
    );

    assert.deepEqual(allMutators, [own]);
  });

  it('does nothing when none of the built-ins is present, as an earlier call removed them', () => {
    const own = listed('MuirMoiraMutatorsOwn');
    const allMutators = [own];

    muirMoiraMutatorsRemoveBuiltIns(
      packageName,
      fakeInstrumenter(allMutators),
      ignoreWarning,
    );

    assert.deepEqual(allMutators, [own]);
  });

  it('warns once about each unmarked entry that is not a built-in, and keeps it', () => {
    const unknown = listed('NewStrykerMutator');
    const marked = {
      ...listed('MuirMoiraMutatorsMarked'),
      [Symbol.for('@muirjs/other')]: 1,
    };
    const allMutators = [
      ...muirMoiraMutatorsBuiltInNames.map(listed),
      unknown,
      marked,
    ];
    const warnings: string[] = [];

    muirMoiraMutatorsRemoveBuiltIns(
      packageName,
      fakeInstrumenter(allMutators),
      (message) => warnings.push(message),
    );

    assert.deepEqual(warnings, [
      "@muirjs/test-mutators: the mutator NewStrykerMutator is not one of Stryker's 17 built-ins and has no " +
        '@muirjs mark, so it stays on in this run; this package has not reviewed whether it fits test code.',
    ]);
    assert.deepEqual(allMutators, [unknown, marked]);
  });

  it('warns about an entry whose symbol is registered under another scope', () => {
    const foreign = {
      ...listed('ForeignMutator'),
      [Symbol.for('@other/mutators')]: 1,
    };
    const warnings: string[] = [];

    muirMoiraMutatorsRemoveBuiltIns(
      packageName,
      fakeInstrumenter([...muirMoiraMutatorsBuiltInNames.map(listed), foreign]),
      (message) => warnings.push(message),
    );

    assert.equal(warnings.length, 1);
  });

  it('warns about an entry whose only symbol is not registered', () => {
    const unregistered = {
      ...listed('UnregisteredMutator'),
      [Symbol('@muirjs/mutators')]: 1,
    };
    const warnings: string[] = [];

    muirMoiraMutatorsRemoveBuiltIns(
      packageName,
      fakeInstrumenter([
        ...muirMoiraMutatorsBuiltInNames.map(listed),
        unregistered,
      ]),
      (message) => warnings.push(message),
    );

    assert.equal(warnings.length, 1);
  });

  it('does not warn when none of the built-ins is present, as nothing is removed', () => {
    const warnings: string[] = [];

    muirMoiraMutatorsRemoveBuiltIns(
      packageName,
      fakeInstrumenter([listed('NewStrykerMutator')]),
      (message) => warnings.push(message),
    );

    assert.deepEqual(warnings, []);
  });

  it('throws, naming the missing ones, when only some built-ins are present', () => {
    const allMutators = muirMoiraMutatorsBuiltInNames
      .filter((name) => name !== 'Regex' && name !== 'UpdateOperator')
      .map(listed);
    const before = [...allMutators];

    assert.throws(
      () =>
        muirMoiraMutatorsRemoveBuiltIns(
          packageName,
          fakeInstrumenter(allMutators),
          ignoreWarning,
        ),
      {
        message:
          '@muirjs/test-mutators: @stryker-mutator/instrumenter 1.2.3 in /fake/instrumenter has no built-in mutators named ' +
          "Regex, UpdateOperator, so this package's list of Stryker's built-ins is out of date.",
      },
    );
    assert.deepEqual(allMutators, before);
  });
});

describe('checkBuiltInsRemoved', () => {
  const instrumenterMaking = (mutatorNames: readonly string[]) => ({
    dir: '/fake/instrumenter',
    version: '1.2.3',
    instrument: async (files: readonly { name: string }[]) =>
      mutatorNames.map((mutatorName) => ({
        fileName: files[0]?.name ?? '',
        mutatorName,
      })),
  });

  it('throws, naming the built-ins that still made a mutant of the sample, in the order of the 17', async () => {
    await assert.rejects(
      muirMoiraMutatorsCheckBuiltInsRemoved(
        packageName,
        instrumenterMaking([
          'Regex',
          'MuirMoiraMutatorsOwn',
          'ArrowFunction',
          'Regex',
        ]),
      ),
      {
        message:
          '@muirjs/test-mutators: the instrumenter 1.2.3 in /fake/instrumenter still made mutants of the built-ins ' +
          'ArrowFunction, Regex after this package removed them, so it does not run the list this package changed. ' +
          'A bundled or second copy of the instrumenter does that.',
      },
    );
  });

  it('passes when no built-in made a mutant, and instruments the sample once as one file', async () => {
    const seen: { name: string; content: string }[][] = [];
    const instrumenter = {
      ...instrumenterMaking([]),
      instrument: async (
        files: readonly { name: string; content: string }[],
      ) => {
        seen.push([...files]);

        return [
          {
            fileName: 'built-ins.self-check.tsx',
            mutatorName: 'MuirMoiraMutatorsOwn',
          },
        ];
      },
    };

    await muirMoiraMutatorsCheckBuiltInsRemoved(packageName, instrumenter);

    assert.deepEqual(seen, [
      [
        {
          name: 'built-ins.self-check.tsx',
          content: muirMoiraMutatorsBuiltInSample,
        },
      ],
    ]);
  });
});

describe('builtInNames', () => {
  it('lists the 17 built-in mutators of Stryker', () => {
    assert.deepEqual([...muirMoiraMutatorsBuiltInNames].sort(), [
      'ArithmeticOperator',
      'ArrayDeclaration',
      'ArrowFunction',
      'AssignmentOperator',
      'BlockStatement',
      'BooleanLiteral',
      'CallExpression',
      'ConditionalExpression',
      'EqualityOperator',
      'LogicalOperator',
      'MethodExpression',
      'ObjectLiteral',
      'OptionalChaining',
      'Regex',
      'StringLiteral',
      'UnaryOperator',
      'UpdateOperator',
    ]);
  });
});
