import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  muirBySide,
  muirCompare,
  muirComparison,
  muirScore,
} from '../../src/oss/verdicts.ts';
import type { MuirMutantDetail, MuirMutantStatus } from '../../src/report.ts';

function mutant(
  line: number,
  status: MuirMutantStatus,
  replacement = 'x',
  endColumn = 9,
): MuirMutantDetail {
  return {
    line,
    column: 3,
    endLine: line,
    endColumn,
    mutator: 'StringLiteral',
    replacement,
    status,
    static: false,
    statusReason: '',
    killedBy: [],
    coveredBy: [],
  };
}

describe('muirScore', () => {
  it('counts each status and scores as Stryker does, without CompileError, RuntimeError or Ignored', () => {
    const mutants = (
      [
        'Killed',
        'Timeout',
        'Survived',
        'NoCoverage',
        'RuntimeError',
        'Ignored',
        'Killed',
      ] satisfies MuirMutantStatus[]
    ).map((status, line) => mutant(line, status));

    assert.deepEqual(muirScore(mutants), {
      counts: {
        Ignored: 1,
        Killed: 2,
        NoCoverage: 1,
        RuntimeError: 1,
        Survived: 1,
        Timeout: 1,
      },
      score: 60,
    });
  });

  it('lists the counts by status in sorted order, whatever order the mutants have', () => {
    const { counts } = muirScore([
      mutant(1, 'Survived'),
      mutant(2, 'Killed'),
      mutant(3, 'NoCoverage'),
    ]);

    assert.deepEqual(Object.keys(counts), ['Killed', 'NoCoverage', 'Survived']);
  });

  it('has no score without a valid mutant', () => {
    assert.equal(muirScore([mutant(1, 'CompileError')]).score, null);
  });
});

describe('muirCompare', () => {
  it("pairs the sides' verdicts by file, place, mutator and replacement", () => {
    const muir = new Map([
      ['index.js', [mutant(1, 'Killed'), mutant(2, 'Survived', 'a\n  b')]],
    ]);
    const command = new Map([
      [
        'index.js',
        [
          mutant(1, 'Killed'),
          mutant(2, 'Killed', 'a\n  b'),
          mutant(4, 'Timeout'),
        ],
      ],
    ]);

    assert.deepEqual(muirCompare(muir, command), [
      {
        mutant: 'index.js:1:3-1:9 StringLiteral x',
        muir: 'Killed',
        command: 'Killed',
      },
      {
        mutant: 'index.js:2:3-2:9 StringLiteral a b',
        muir: 'Survived',
        command: 'Killed',
      },
      {
        mutant: 'index.js:4:3-4:9 StringLiteral x',
        muir: null,
        command: 'Timeout',
      },
    ]);
  });

  it('refuses a report with two mutants at one place, mutator and replacement', () => {
    const muir = new Map([
      ['index.js', [mutant(1, 'Killed'), mutant(1, 'Survived')]],
    ]);

    assert.throws(() => muirCompare(muir, new Map()), {
      message:
        'Two mutants share the key "index.js:1:3-1:9 StringLiteral x"; the comparison would drop one.',
    });
  });

  it('keeps apart two mutants whose replacements differ in whitespace only, as Stryker keys them', () => {
    const muir = new Map([
      ['index.js', [mutant(1, 'Survived', 'a  b'), mutant(1, 'Killed', 'a b')]],
    ]);
    const command = new Map([
      ['index.js', [mutant(1, 'Killed', 'a  b'), mutant(1, 'Killed', 'a b')]],
    ]);

    assert.deepEqual(muirCompare(muir, command), [
      {
        mutant: 'index.js:1:3-1:9 StringLiteral a b',
        muir: 'Survived',
        command: 'Killed',
      },
      {
        mutant: 'index.js:1:3-1:9 StringLiteral a b',
        muir: 'Killed',
        command: 'Killed',
      },
    ]);
  });

  it('keeps apart two mutants that start at one place and end at two', () => {
    const muir = new Map([
      [
        'index.js',
        [mutant(1, 'Killed', 'true', 20), mutant(1, 'Survived', 'true', 40)],
      ],
    ]);
    const command = new Map([
      [
        'index.js',
        [mutant(1, 'Killed', 'true', 20), mutant(1, 'Killed', 'true', 40)],
      ],
    ]);

    assert.deepEqual(
      muirCompare(muir, command).map(({ muir: status }) => status),
      ['Killed', 'Survived'],
    );
  });
});

describe('muirBySide', () => {
  it('keys each value by its side and leaves out the sides with no item', () => {
    assert.deepEqual(
      muirBySide(
        [{ side: 'command', exitCode: 1 }],
        ({ exitCode }) => exitCode,
      ),
      { command: 1 },
    );
  });
});

describe('muirComparison', () => {
  it('compares nothing when one side did not run, and says so', () => {
    assert.deepEqual(
      muirComparison({ command: { reported: true, report: new Map() } }),
      {
        compared: false,
        reason:
          'Only the command side ran; merge its result.json with a muir run with --merge.',
      },
    );
  });

  it('says no side ran when there is no report to name', () => {
    assert.deepEqual(muirComparison({}), {
      compared: false,
      reason: 'No side ran.',
    });
  });

  it('compares nothing when a side that ran wrote no report', () => {
    assert.deepEqual(
      muirComparison({
        muir: { reported: false },
        command: { reported: true, report: new Map() },
      }),
      {
        compared: false,
        reason: 'A side wrote no report.',
      },
    );
  });

  it('lists the disagreements when both sides have a report', () => {
    const muir = new Map([
      ['index.js', [mutant(1, 'Killed'), mutant(2, 'Survived')]],
    ]);
    const command = new Map([
      ['index.js', [mutant(1, 'Killed'), mutant(2, 'Killed')]],
    ]);

    assert.deepEqual(
      muirComparison({
        muir: { reported: true, report: muir },
        command: { reported: true, report: command },
      }),
      {
        compared: true,
        disagreements: [
          {
            mutant: 'index.js:2:3-2:9 StringLiteral x',
            muir: 'Survived',
            command: 'Killed',
          },
        ],
        verdicts: muirCompare(muir, command),
      },
    );
  });
});
