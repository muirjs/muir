import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Ignorer } from '@stryker-mutator/api/ignore';

import {
  muirAssertEveryOutcome,
  muirIgnorerOutcomes,
  muirInstrument,
  muirValidateOptions,
} from '../src/index.ts';

const ignoreAll: Ignorer = { shouldIgnore: () => 'every mutant' };
const ignoreNone: Ignorer = { shouldIgnore: () => undefined };
const conditional = "const label = on ? 'a' : 'b';";

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

describe('muirIgnorerOutcomes', () => {
  it('gives the reason of each mutant the ignorer ignores', async () => {
    const outcomes = await muirIgnorerOutcomes(ignoreAll, conditional);

    assert.ok(outcomes.length > 1);
    assert.deepEqual(new Set(outcomes), new Set(['every mutant']));
  });

  it('gives placed for each mutant the ignorer keeps', async () => {
    const outcomes = await muirIgnorerOutcomes(ignoreNone, conditional);

    assert.ok(outcomes.length > 1);
    assert.deepEqual(new Set(outcomes), new Set(['placed']));
  });

  it('parses the code as TSX by default', async () => {
    const outcomes = await muirIgnorerOutcomes(
      ignoreNone,
      "const view = <T,>(item: T) => <p>{on ? 'a' : 'b'}</p>;",
    );

    assert.ok(outcomes.length > 0);
  });

  it('parses the code by the file name it is given', async () => {
    await assert.rejects(
      muirIgnorerOutcomes(ignoreNone, 'const n: number = on ? 1 : 2;', 'a.js'),
    );
  });
});

describe('muirAssertEveryOutcome', () => {
  it('passes when every mutant has the outcome', async () => {
    await muirAssertEveryOutcome(ignoreAll, conditional, 'every mutant');
  });

  it('fails when a mutant has another outcome', async () => {
    await assert.rejects(
      muirAssertEveryOutcome(ignoreNone, conditional, 'every mutant'),
      /every mutant/,
    );
  });

  it('fails when the code has no mutants', async () => {
    await assert.rejects(
      muirAssertEveryOutcome(ignoreAll, 'f;', 'every mutant'),
      /no mutants in f;/,
    );
  });

  it('passes the file name on', async () => {
    await assert.rejects(
      muirAssertEveryOutcome(
        ignoreNone,
        'const n: number = on ? 1 : 2;',
        'placed',
        'a.js',
      ),
    );
  });
});

describe('muirValidateOptions', () => {
  const contribution = {
    type: 'object',
    properties: {
      muirTestOptions: {
        type: 'object',
        additionalProperties: false,
        properties: { label: { type: 'string' } },
      },
    },
  };

  it('accepts options that a contributed schema allows', async () => {
    assert.deepEqual(
      await muirValidateOptions({ muirTestOptions: { label: 'a' } }, [
        contribution,
      ]),
      { valid: true, log: [] },
    );
  });

  it('rejects options that a contributed schema forbids, and logs why', async () => {
    const { valid, log } = await muirValidateOptions(
      { muirTestOptions: { label: 1 } },
      [contribution],
    );

    assert.equal(valid, false);
    assert.match(log.join('\n'), /^error .*label/m);
  });

  it('warns about options no schema names', async () => {
    const { valid, log } = await muirValidateOptions(
      { muirTestOptions: { label: 'a' } },
      [],
    );

    assert.equal(valid, true);
    assert.match(log.join('\n'), /^warn .*muirTestOptions/m);
  });

  it('leaves the options it is given unchanged', async () => {
    const options = { muirTestOptions: { label: 'a' } };

    await muirValidateOptions(options, [contribution]);

    assert.deepEqual(options, { muirTestOptions: { label: 'a' } });
  });
});
