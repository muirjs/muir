import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'node:test';

import { builtInNames } from '@layzee/stryker-mutator-install';

import { mutatorSets } from '../src/mutators.ts';
import { packageName } from '../src/package-name.ts';

const readmeLines = readFileSync(
  join(import.meta.dirname, '..', 'README.md'),
  'utf8',
).split(/\r?\n/);

/** The lines under `heading` up to the next heading; fails when the README has no such heading. */
function sectionLines(heading: string): readonly string[] {
  const start = readmeLines.indexOf(heading);

  assert.notEqual(start, -1, `the README has the heading ${heading}`);

  const section = readmeLines.slice(start + 1);
  const end = section.findIndex((line) => line.startsWith('#'));

  return section.slice(0, end === -1 ? section.length : end);
}

function tableNames(heading: string): readonly string[] {
  return sectionLines(heading).flatMap(
    (line) => /^\| `(\w+)` +\|/.exec(line)?.slice(1) ?? [],
  );
}

function namesOf(
  tier: readonly { readonly name: string }[],
): readonly string[] {
  return tier.map(({ name }) => name);
}

function verb(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

it('gives the size of each tier in the opening counts and in the default install line', () => {
  const { defaults, optIn, experimental } = mutatorSets;
  const total = defaults.length + optIn.length + experimental.length;
  const readme = readmeLines.join(' ');

  assert.ok(
    readme.includes(
      `turns Stryker's ${builtInNames.length} built-in mutators off and adds ${total} of its own: ${verb(defaults.length, 'runs', 'run')} by default, ${verb(optIn.length, 'is', 'are')} opt-in and ${verb(experimental.length, 'is', 'are')} experimental.`,
    ),
    'the opening counts',
  );
  assert.ok(
    readme.includes(
      `${packageName}: Stryker's ${builtInNames.length} built-in mutators are off for every file in this run; ${defaults.length} LzStorybook mutators on.`,
    ),
    'the default install line',
  );
});

it('lists the mutators of each tier in the README table of that tier, in roster order', () => {
  assert.deepEqual(
    {
      defaults: tableNames('### Default mutators'),
      optIn: tableNames('### Opt-in mutators'),
      experimental: tableNames('### Experimental mutators'),
    },
    {
      defaults: namesOf(mutatorSets.defaults),
      optIn: namesOf(mutatorSets.optIn),
      experimental: namesOf(mutatorSets.experimental),
    },
  );
});
