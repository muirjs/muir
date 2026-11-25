import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, type TestContext } from 'node:test';

import {
  muirTestReadmeTiers,
  type MuirMutatorTiers,
  type MuirReadmeFacts,
} from '../src/readme-tiers.ts';
import { muirTempRoot } from '../src/temp-tree.ts';

const countsCheck =
  'gives the size of each tier in the opening counts and in the default install line';
const tablesCheck =
  'lists the mutators of each tier in the README table of that tier, in roster order';
const noneCheck =
  'says None under the heading of each tier that has no mutator, and only there';

const tiers: MuirMutatorTiers = {
  defaults: [{ name: 'MuirA' }, { name: 'MuirB' }],
  optIn: [{ name: 'MuirC' }],
  experimental: [],
};
const facts: MuirReadmeFacts = {
  packageName: '@muirjs/example',
  prefix: 'MuirExample',
  builtIns: 'on',
  builtInCount: 5,
};
const readme = `# @muirjs/example

The package keeps Stryker's 5 built-in mutators on and adds 3 of its own: 2 run by default, 1 is opt-in and 0 are
experimental.

@muirjs/example: 2 MuirExample mutators on, beside Stryker's built-in mutators.

### Default mutators

| Mutator | Change |
| ------- | ------ |
| \`MuirA\`   | a      |
| \`MuirB\`   | b      |

### Opt-in mutators

| \`MuirC\` | c |

### Experimental mutators

None.
`;
const offTiers: MuirMutatorTiers = {
  defaults: [{ name: 'MuirA' }],
  optIn: [{ name: 'MuirB' }, { name: 'MuirC' }],
  experimental: [{ name: 'MuirD' }],
};
const offFacts: MuirReadmeFacts = {
  ...facts,
  builtIns: 'off',
  builtInCount: 17,
};
const offReadme = `The package turns Stryker's 17 built-in mutators off and adds 4 of its own: 1 runs by default, 2 are opt-in and
1 is experimental.

@muirjs/example: Stryker's 17 built-in mutators are off for every file in this run; 1 MuirExample mutators on.

### Default mutators

| \`MuirA\` | a |

### Opt-in mutators

| \`MuirB\` | b |
| \`MuirC\` | c |

### Experimental mutators

| \`MuirD\` | d |
`;

/** The checks `testReadmeTiers` registers for `text` as the README, by name, in the order it registers them. */
function checksOf(
  t: TestContext,
  text: string,
  readmeTiers: MuirMutatorTiers = tiers,
  readmeFacts: MuirReadmeFacts = facts,
): ReadonlyMap<string, () => void> {
  const path = join(muirTempRoot(t, 'muir-readme-tiers-'), 'README.md');
  const checks = new Map<string, () => void>();

  writeFileSync(path, text);
  muirTestReadmeTiers(path, readmeTiers, readmeFacts, (name, check) => {
    checks.set(name, check);
  });

  return checks;
}

/** `text` with `from` replaced by `to`; fails when `text` has no `from`, so an edit cannot silently miss. */
function edited(text: string, from: string, to: string): string {
  assert.ok(text.includes(from), `the README has ${from}`);

  return text.replace(from, to);
}

function run(checks: ReadonlyMap<string, () => void>, name: string): void {
  const check = checks.get(name);

  assert.ok(check !== undefined, `a check named ${name}`);
  check();
}

describe('testReadmeTiers', () => {
  it('registers the counts, tables and None checks, in that order', (t) => {
    assert.deepEqual(
      [...checksOf(t, readme).keys()],
      [countsCheck, tablesCheck, noneCheck],
    );
  });

  it('passes a README that matches its tiers, with the built-ins on', (t) => {
    const checks = checksOf(t, readme);

    [countsCheck, tablesCheck, noneCheck].forEach((name) => {
      run(checks, name);
    });
  });

  it('passes a README that matches its tiers, with the built-ins off and the other form of each count', (t) => {
    const checks = checksOf(t, offReadme, offTiers, offFacts);

    [countsCheck, tablesCheck, noneCheck].forEach((name) => {
      run(checks, name);
    });
  });

  it('fails the counts when the opening says the built-ins are off while they are on', (t) => {
    const checks = checksOf(
      t,
      edited(
        readme,
        "keeps Stryker's 5 built-in mutators on",
        "turns Stryker's 5 built-in mutators off",
      ),
    );

    assert.throws(() => run(checks, countsCheck), {
      message: 'the opening counts',
    });
  });

  it('fails the counts when the opening says the built-ins are on while they are off', (t) => {
    const checks = checksOf(
      t,
      edited(
        offReadme,
        "turns Stryker's 17 built-in mutators off",
        "keeps Stryker's 17 built-in mutators on",
      ),
      offTiers,
      offFacts,
    );

    assert.throws(() => run(checks, countsCheck), {
      message: 'the opening counts',
    });
  });

  it('fails the counts when the opening gives a wrong total', (t) => {
    const checks = checksOf(
      t,
      edited(readme, 'adds 3 of its own', 'adds 4 of its own'),
    );

    assert.throws(() => run(checks, countsCheck), {
      message: 'the opening counts',
    });
  });

  it('fails the counts when one tier has a wrong count and the total is right', (t) => {
    const checks = checksOf(
      t,
      edited(readme, '1 is opt-in and 0 are', '0 are opt-in and 1 is'),
    );

    assert.throws(() => run(checks, countsCheck), {
      message: 'the opening counts',
    });
  });

  it('passes a README with Windows line endings', (t) => {
    const checks = checksOf(t, readme.replaceAll('\n', '\r\n'));

    [countsCheck, tablesCheck, noneCheck].forEach((name) => {
      run(checks, name);
    });
  });

  it('fails the counts when the default install line gives a wrong count, with the built-ins on', (t) => {
    const checks = checksOf(
      t,
      edited(
        readme,
        '2 MuirExample mutators on, beside',
        '3 MuirExample mutators on, beside',
      ),
    );

    assert.throws(() => run(checks, countsCheck), {
      message: 'the default install line',
    });
  });

  it('fails the counts when the default install line gives a wrong count, with the built-ins off', (t) => {
    const checks = checksOf(
      t,
      edited(offReadme, 'this run; 1 MuirExample', 'this run; 2 MuirExample'),
      offTiers,
      offFacts,
    );

    assert.throws(() => run(checks, countsCheck), {
      message: 'the default install line',
    });
  });

  it('fails the tables when a table lists its mutators out of roster order', (t) => {
    const checks = checksOf(
      t,
      edited(
        readme,
        '| `MuirA`   | a      |\n| `MuirB`   | b      |',
        '| `MuirB`   | b      |\n| `MuirA`   | a      |',
      ),
    );

    assert.throws(() => run(checks, tablesCheck), { generatedMessage: true });
  });

  it('fails the tables, naming the heading, when the README has no heading for a tier', (t) => {
    const checks = checksOf(
      t,
      edited(readme, '### Opt-in mutators', '### Opt-in'),
    );

    assert.throws(() => run(checks, tablesCheck), {
      message: 'the README has the heading ### Opt-in mutators',
    });
  });

  it('passes the tables when a quoted row stands under a tier heading, as it is no row of that table', (t) => {
    const checks = checksOf(
      t,
      edited(
        readme,
        '| `MuirB`   | b      |',
        '| `MuirB`   | b      |\n> | `MuirZ` | quoted |',
      ),
    );

    run(checks, tablesCheck);
  });

  it('fails None when an empty tier has no None under its heading', (t) => {
    const checks = checksOf(t, edited(readme, 'None.', 'Nothing yet.'));

    assert.throws(() => run(checks, noneCheck), { generatedMessage: true });
  });

  it('fails None when nothing stands under the heading of an empty tier', (t) => {
    const checks = checksOf(t, edited(readme, 'None.', ''));

    assert.throws(() => run(checks, noneCheck), { generatedMessage: true });
  });

  it('fails None when a tier with a mutator has None under its heading', (t) => {
    const checks = checksOf(
      t,
      edited(readme, '| `MuirC` | c |', 'None.\n\n| `MuirC` | c |'),
    );

    assert.throws(() => run(checks, noneCheck), { generatedMessage: true });
  });

  it('passes None when the None line goes on after None.', (t) => {
    const checks = checksOf(
      t,
      edited(
        readme,
        'None.',
        'None. The package has no experimental mutators yet.',
      ),
    );

    run(checks, noneCheck);
  });

  it('passes None when the README ends in the None line with no newline after it', (t) => {
    const checks = checksOf(t, readme.trimEnd());

    run(checks, noneCheck);
  });
});
