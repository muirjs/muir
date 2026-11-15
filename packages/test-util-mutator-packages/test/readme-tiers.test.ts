import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, type TestContext } from 'node:test';

import {
  testReadmeTiers,
  type MutatorTiers,
  type ReadmeFacts,
} from '../src/readme-tiers.ts';
import { tempRoot } from '../src/temp-tree.ts';

const countsCheck =
  'gives the size of each tier in the opening counts and in the default install line';
const tablesCheck =
  'lists the mutators of each tier in the README table of that tier, in roster order';
const noneCheck =
  'says None under the heading of each tier that has no mutator, and only there';

const tiers: MutatorTiers = {
  defaults: [{ name: 'LzA' }, { name: 'LzB' }],
  optIn: [{ name: 'LzC' }],
  experimental: [],
};
const facts: ReadmeFacts = {
  packageName: '@layzee/example',
  prefix: 'LzExample',
  builtIns: 'on',
  builtInCount: 5,
};
const readme = `# @layzee/example

The package keeps Stryker's 5 built-in mutators on and adds 3 of its own: 2 run by default, 1 is opt-in and 0 are
experimental.

@layzee/example: 2 LzExample mutators on, beside Stryker's built-in mutators.

### Default mutators

| Mutator | Change |
| ------- | ------ |
| \`LzA\`   | a      |
| \`LzB\`   | b      |

### Opt-in mutators

| \`LzC\` | c |

### Experimental mutators

None.
`;
const offTiers: MutatorTiers = {
  defaults: [{ name: 'LzA' }],
  optIn: [{ name: 'LzB' }, { name: 'LzC' }],
  experimental: [{ name: 'LzD' }],
};
const offFacts: ReadmeFacts = { ...facts, builtIns: 'off', builtInCount: 17 };
const offReadme = `The package turns Stryker's 17 built-in mutators off and adds 4 of its own: 1 runs by default, 2 are opt-in and
1 is experimental.

@layzee/example: Stryker's 17 built-in mutators are off for every file in this run; 1 LzExample mutators on.

### Default mutators

| \`LzA\` | a |

### Opt-in mutators

| \`LzB\` | b |
| \`LzC\` | c |

### Experimental mutators

| \`LzD\` | d |
`;

/** The checks `testReadmeTiers` registers for `text` as the README, by name, in the order it registers them. */
function checksOf(
  t: TestContext,
  text: string,
  readmeTiers: MutatorTiers = tiers,
  readmeFacts: ReadmeFacts = facts,
): ReadonlyMap<string, () => void> {
  const path = join(tempRoot(t, 'lz-readme-tiers-'), 'README.md');
  const checks = new Map<string, () => void>();

  writeFileSync(path, text);
  testReadmeTiers(path, readmeTiers, readmeFacts, (name, check) => {
    checks.set(name, check);
  });

  return checks;
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
      readme.replace(
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
      offReadme.replace(
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
      readme.replace('adds 3 of its own', 'adds 4 of its own'),
    );

    assert.throws(() => run(checks, countsCheck), {
      message: 'the opening counts',
    });
  });

  it('fails the counts when the default install line gives a wrong count, with the built-ins on', (t) => {
    const checks = checksOf(
      t,
      readme.replace(
        '2 LzExample mutators on, beside',
        '3 LzExample mutators on, beside',
      ),
    );

    assert.throws(() => run(checks, countsCheck), {
      message: 'the default install line',
    });
  });

  it('fails the counts when the default install line gives a wrong count, with the built-ins off', (t) => {
    const checks = checksOf(
      t,
      offReadme.replace('this run; 1 LzExample', 'this run; 2 LzExample'),
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
      readme.replace(
        '| `LzA`   | a      |\n| `LzB`   | b      |',
        '| `LzB`   | b      |\n| `LzA`   | a      |',
      ),
    );

    assert.throws(() => run(checks, tablesCheck), assert.AssertionError);
  });

  it('fails the tables, naming the heading, when the README has no heading for a tier', (t) => {
    const checks = checksOf(
      t,
      readme.replace('### Opt-in mutators', '### Opt-in'),
    );

    assert.throws(() => run(checks, tablesCheck), {
      message: 'the README has the heading ### Opt-in mutators',
    });
  });

  it('reads as table rows only the lines that start with the row', (t) => {
    const checks = checksOf(
      t,
      readme.replace(
        '| `LzB`   | b      |',
        '| `LzB`   | b      |\n> | `LzZ` | quoted |',
      ),
    );

    run(checks, tablesCheck);
  });

  it('fails None when an empty tier has no None under its heading', (t) => {
    const checks = checksOf(t, readme.replace('None.', 'Nothing yet.'));

    assert.throws(() => run(checks, noneCheck), assert.AssertionError);
  });

  it('fails None when a tier with a mutator has None under its heading', (t) => {
    const checks = checksOf(
      t,
      readme.replace('| `LzC` | c |', 'None.\n\n| `LzC` | c |'),
    );

    assert.throws(() => run(checks, noneCheck), assert.AssertionError);
  });

  it('reads the last section to the end of a README with no newline at its end', (t) => {
    const checks = checksOf(t, readme.trimEnd());

    run(checks, noneCheck);
  });
});
