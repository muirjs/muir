import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Ignorer } from '@stryker-mutator/api/ignore';

import { muirInstrument } from '../src/index.ts';

const ignoreAll: Ignorer = { shouldIgnore: () => 'every mutant' };
const ignoreNone: Ignorer = { shouldIgnore: () => undefined };

describe('muirInstrument', () => {
  it('gives each mutant its mutator, its 1-based place and its replacement', async () => {
    const { mutants } = await muirInstrument('a.ts', "\nconst a = 'x';", [
      ignoreNone,
    ]);

    assert.deepEqual(mutants, [
      {
        mutatorName: 'StringLiteral',
        line: 2,
        location: {
          start: { line: 2, column: 11 },
          end: { line: 2, column: 14 },
        },
        replacement: '""',
        ignoreReason: undefined,
      },
    ]);
  });

  it("gives the ignorer's reason to a mutant it ignores", async () => {
    const { mutants } = await muirInstrument('a.ts', "const a = 'x';", [
      ignoreAll,
    ]);

    assert.deepEqual(
      mutants.map(({ ignoreReason }) => ignoreReason),
      ['every mutant'],
    );
  });

  it('gives no ignore reason to a mutant StrykerJS places, though a directive gave it an empty one', async () => {
    const { mutants } = await muirInstrument(
      'a.ts',
      "// Stryker disable next-line all: \nconst a = 'x';",
      [ignoreNone],
    );

    assert.deepEqual(
      mutants.map(({ ignoreReason }) => ignoreReason),
      [undefined],
    );
  });

  it('gives the instrumented code, and no warnings for code it reads', async () => {
    const { code, warnings } = await muirInstrument('a.ts', "const a = 'x';", [
      ignoreNone,
    ]);

    assert.match(code, /stryMutAct_9fa48/);
    assert.deepEqual(warnings, []);
  });

  it("gives StrykerJS's warnings about the code", async () => {
    const { warnings } = await muirInstrument(
      'a.ts',
      "// Stryker disable next-line NoSuchMutator: a\nconst a = 'x';",
      [ignoreNone],
    );

    assert.deepEqual(warnings, [
      "Unused 'Stryker disable next-line' directive. Mutator with name 'NoSuchMutator' not found. Directive found at: a.ts:1:0.",
    ]);
  });
});
