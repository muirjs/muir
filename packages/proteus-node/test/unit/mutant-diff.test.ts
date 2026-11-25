import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import { types } from '@babel/core';

import type {
  MuirMoiraMutatorsMutant,
  MuirMoiraMutatorsBabelInstrumenter,
  MuirMoiraMutatorsStrykerMutator,
  MuirMoiraMutatorsBabelMutator,
  MuirMoiraMutatorsSourceFile,
} from '@muirjs/moira-mutators';
import {
  muirProteusNodeCorpusDiff,
  muirProteusNodeMutantDiff,
} from '../../src/mutant-diff.ts';

function mutant(
  mutatorName: string,
  line: number,
  column: number,
  replacement = ';',
): MuirMoiraMutatorsMutant {
  return {
    fileName: 'a.ts',
    mutatorName,
    replacement,
    location: { start: { line, column }, end: { line, column: column + 1 } },
  };
}

describe('mutantDiff', () => {
  it('lists the mutants only one side has, from line and column 1, as often as they occur', () => {
    const before = [
      mutant('CallExpression', 0, 4),
      mutant('StringLiteral', 2, 0, '""'),
      mutant('StringLiteral', 2, 0, '""'),
    ];
    const after = [
      mutant('StringLiteral', 2, 0, '""'),
      mutant(
        'MuirProteusNodeTestAssertCall',
        0,
        4,
        'throw new Error(\n  "x"\n);',
      ),
      mutant(
        'MuirProteusNodeTestAssertCall',
        0,
        4,
        'throw new Error(\n  "x"\n);',
      ),
    ];

    assert.deepEqual(muirProteusNodeMutantDiff(before, after), {
      added: [
        '1:5 MuirProteusNodeTestAssertCall throw new Error( "x" );',
        '1:5 MuirProteusNodeTestAssertCall throw new Error( "x" );',
      ],
      removed: ['1:5 CallExpression ;', '3:1 StringLiteral ""'],
    });
  });

  it('lists nothing when both sides have the same mutants', () => {
    const mutants = [
      mutant('CallExpression', 0, 4),
      mutant('StringLiteral', 2, 0, '""'),
    ];

    assert.deepEqual(muirProteusNodeMutantDiff(mutants, [...mutants]), {
      added: [],
      removed: [],
    });
  });
});

describe('corpusDiff', () => {
  async function setup(names: string[]) {
    const read: string[] = [];
    const instrumented: [MuirMoiraMutatorsSourceFile[], string[]][] = [];
    const instrumenter: MuirMoiraMutatorsBabelInstrumenter = {
      dir: '/stryker/instrumenter',
      version: '10.1.1',
      allMutators: [{ name: 'StringLiteral', *mutate() {} }],
      types,
      instrument(
        files,
        mutators: readonly MuirMoiraMutatorsStrykerMutator[] = [],
      ) {
        instrumented.push([[...files], mutators.map(({ name }) => name)]);

        return Promise.resolve(mutators.map(({ name }) => mutant(name, 0, 0)));
      },
    };
    const own: MuirMoiraMutatorsBabelMutator = {
      name: 'Own',
      sample: '',
      *mutate() {},
    };
    const text = await muirProteusNodeCorpusDiff(
      names,
      (name) => (name.includes('owned') ? [own] : []),
      () => Promise.resolve(instrumenter),
      (name) => {
        read.push(name);

        return `content of ${name}`;
      },
    );

    return { text, read, instrumented };
  }

  it("reports each file, relative to the working directory, with and without that file's mutators", async () => {
    const owned = resolve('tools', 'owned.ts');
    const { text, read, instrumented } = await setup([owned, 'plain.ts']);

    assert.equal(
      text,
      '### tools/owned.ts\n\n1 mutants without the mutators, 2 with them.\n\n    + 1:1 Own ;\n\n' +
        '### plain.ts\n\n1 mutants without the mutators, 1 with them.\n\n    (no difference)\n',
    );
    assert.deepEqual(read, [owned, 'plain.ts']);
    assert.deepEqual(instrumented, [
      [[{ name: owned, content: `content of ${owned}` }], ['StringLiteral']],
      [
        [{ name: owned, content: `content of ${owned}` }],
        ['StringLiteral', 'Own'],
      ],
      [
        [{ name: 'plain.ts', content: 'content of plain.ts' }],
        ['StringLiteral'],
      ],
      [
        [{ name: 'plain.ts', content: 'content of plain.ts' }],
        ['StringLiteral'],
      ],
    ]);
  });

  it('lists a mutant that a mutator removes', async () => {
    const instrumenter: MuirMoiraMutatorsBabelInstrumenter = {
      dir: '/stryker/instrumenter',
      version: '10.1.1',
      allMutators: [],
      types,
      instrument(_files, mutators = []) {
        return Promise.resolve([
          mutators.length > 0
            ? mutant('Own', 0, 0)
            : mutant('CallExpression', 0, 0),
        ]);
      },
    };

    assert.equal(
      await muirProteusNodeCorpusDiff(
        ['a.ts'],
        () => [{ name: 'Own', sample: '', *mutate() {} }],
        () => Promise.resolve(instrumenter),
        () => '',
      ),
      '### a.ts\n\n1 mutants without the mutators, 1 with them.\n\n    + 1:1 Own ;\n    - 1:1 CallExpression ;\n',
    );
  });
});
