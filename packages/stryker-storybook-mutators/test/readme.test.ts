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

const tierHeadings = {
  defaults: '### Default mutators',
  optIn: '### Opt-in mutators',
  experimental: '### Experimental mutators',
} as const;

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

/** Whether the section under `heading` opens with "None.", as the README presents an empty tier. */
function saysNone(heading: string): boolean {
  const [first] = sectionLines(heading).filter((line) => line !== '');

  return first?.startsWith('None.') === true;
}

function namesOf(
  tier: readonly { readonly name: string }[],
): readonly string[] {
  return tier.map(({ name }) => name);
}

function isEmpty(tier: readonly unknown[]): boolean {
  return tier.length === 0;
}

function countOf(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

it('gives the size of each tier in the opening counts and in the default install line', () => {
  const { defaults, optIn, experimental } = mutatorSets;
  const total = defaults.length + optIn.length + experimental.length;
  const readme = readmeLines.join(' ');

  assert.ok(
    readme.includes(
      `keeps Stryker's ${builtInNames.length} built-in mutators on and adds ${total} of its own: ${countOf(defaults.length, 'runs', 'run')} by default, ${countOf(optIn.length, 'is', 'are')} opt-in and ${countOf(experimental.length, 'is', 'are')} experimental.`,
    ),
    'the opening counts',
  );
  assert.ok(
    readme.includes(
      `${packageName}: ${defaults.length} LzStorybook mutators on, beside Stryker's built-in mutators.`,
    ),
    'the default install line',
  );
});

it('lists the mutators of each tier in the README table of that tier, in roster order', () => {
  assert.deepEqual(
    {
      defaults: tableNames(tierHeadings.defaults),
      optIn: tableNames(tierHeadings.optIn),
      experimental: tableNames(tierHeadings.experimental),
    },
    {
      defaults: namesOf(mutatorSets.defaults),
      optIn: namesOf(mutatorSets.optIn),
      experimental: namesOf(mutatorSets.experimental),
    },
  );
});

it('says None under the heading of each tier that has no mutator, and only there', () => {
  assert.deepEqual(
    {
      defaults: saysNone(tierHeadings.defaults),
      optIn: saysNone(tierHeadings.optIn),
      experimental: saysNone(tierHeadings.experimental),
    },
    {
      defaults: isEmpty(mutatorSets.defaults),
      optIn: isEmpty(mutatorSets.optIn),
      experimental: isEmpty(mutatorSets.experimental),
    },
  );
});
