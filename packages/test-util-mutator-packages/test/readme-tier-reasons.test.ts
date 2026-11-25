import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, type TestContext } from 'node:test';

import {
  muirTestReadmeTierReasons,
  type MuirMutatorTiers,
} from '../src/readme-tiers.ts';
import { muirTempRoot } from '../src/temp-tree.ts';

const tiers: MuirMutatorTiers = {
  defaults: [{ name: 'MuirA' }],
  optIn: [{ name: 'MuirB' }],
  experimental: [{ name: 'MuirC' }, { name: 'MuirD' }],
};
const noTiers: MuirMutatorTiers = {
  defaults: [{ name: 'MuirA' }],
  optIn: [],
  experimental: [],
};
const readme = `### Experimental mutators

| \`MuirC\` | c |
| \`MuirD\` | d |

### Why a mutator is opt-in or experimental

A paragraph.

| Mutator | Why | What would move it |
| --- | --- | --- |
| \`MuirB\` | Few sites. | 10 sites. |
| \`MuirC\` | One repository. | A second one. |
| \`MuirD\`   | Never measured. | A run. |

## Turn a mutator off
`;

/** Runs the one check `muirTestReadmeTierReasons` registers for `text` as the README. */
function check(
  t: TestContext,
  text: string,
  readmeTiers: MuirMutatorTiers = tiers,
): void {
  const path = join(muirTempRoot(t, 'muir-readme-reasons-'), 'README.md');
  const checks: (() => void)[] = [];

  writeFileSync(path, text);
  muirTestReadmeTierReasons(path, readmeTiers, (_name, registered) => {
    checks.push(registered);
  });
  assert.equal(checks.length, 1, 'one check');
  checks[0]?.();
}

function edited(text: string, from: string, to: string): string {
  assert.ok(text.includes(from), `the README has ${from}`);

  return text.replace(from, to);
}

describe('muirTestReadmeTierReasons', () => {
  it('passes a reasons table that lists the opt-in, then the experimental mutators, in roster order', (t) => {
    check(t, readme);
  });

  it('fails a table that leaves out a mutator', (t) => {
    assert.throws(() => {
      check(
        t,
        edited(readme, '| `MuirD`   | Never measured. | A run. |\n', ''),
      );
    }, assert.AssertionError);
  });

  it('fails a table in another order than the roster', (t) => {
    const swapped = edited(
      edited(readme, '| `MuirB` |', '| `MuirX` |'),
      '| `MuirC` |',
      '| `MuirB` |',
    );

    assert.throws(() => {
      check(t, edited(swapped, '| `MuirX` |', '| `MuirC` |'));
    }, assert.AssertionError);
  });

  it('fails a row without what would move it', (t) => {
    assert.throws(
      () => {
        check(
          t,
          edited(
            readme,
            '| One repository. | A second one. |',
            '| One repository. | |',
          ),
        );
      },
      { message: 'every row has a reason and what would move it' },
    );
  });

  it('fails a README without the reasons heading when the package has opt-in or experimental mutators', (t) => {
    assert.throws(() => {
      check(
        t,
        edited(
          readme,
          '### Why a mutator is opt-in or experimental',
          '### Why',
        ),
      );
    }, /the README has the heading/);
  });

  it('passes a README without a reasons table when the package has no opt-in or experimental mutators', (t) => {
    check(t, '### Default mutators\n\n| `MuirA` | a |\n', noTiers);
  });

  it('fails a reasons table when the package has no opt-in or experimental mutators', (t) => {
    assert.throws(
      () => {
        check(t, readme, noTiers);
      },
      { message: 'no reasons table without opt-in or experimental mutators' },
    );
  });
});
