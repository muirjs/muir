import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';

type Tier = readonly { readonly name: string }[];

export interface MutatorTiers {
  readonly defaults: Tier;
  readonly optIn: Tier;
  readonly experimental: Tier;
}

type TierKey = keyof MutatorTiers;

const tierHeadings: Readonly<Record<TierKey, string>> = {
  defaults: '### Default mutators',
  optIn: '### Opt-in mutators',
  experimental: '### Experimental mutators',
};

function perTier<T>(
  valueOf: (key: TierKey) => T,
): Readonly<Record<TierKey, T>> {
  return {
    defaults: valueOf('defaults'),
    optIn: valueOf('optIn'),
    experimental: valueOf('experimental'),
  };
}

function readmeLines(readmePath: string): readonly string[] {
  return readFileSync(readmePath, 'utf8').split(/\r?\n/);
}

/** The README as one line, so a sentence the file wraps still matches. */
export function readmeText(readmePath: string): string {
  return readmeLines(readmePath).join(' ');
}

export function countOf(
  count: number,
  singular: string,
  plural: string,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** The lines under `heading` up to the next heading; fails when the README has no such heading. */
function sectionLines(
  lines: readonly string[],
  heading: string,
): readonly string[] {
  const start = lines.indexOf(heading);

  assert.notEqual(start, -1, `the README has the heading ${heading}`);

  const section = lines.slice(start + 1);
  const end = section.findIndex((line) => line.startsWith('#'));

  return section.slice(0, end === -1 ? section.length : end);
}

function tableNames(
  lines: readonly string[],
  heading: string,
): readonly string[] {
  return sectionLines(lines, heading).flatMap(
    (line) => /^\| `(\w+)` +\|/.exec(line)?.slice(1) ?? [],
  );
}

/** Whether the section under `heading` opens with "None.", as the README presents an empty tier. */
function saysNone(lines: readonly string[], heading: string): boolean {
  const [first] = sectionLines(lines, heading).filter((line) => line !== '');

  return first?.startsWith('None.') === true;
}

/**
 * Registers the tests that each tier's README table lists that tier's mutators in roster order, and that
 * "None." stands under the heading of each empty tier and only there.
 */
export function testReadmeTiers(readmePath: string, tiers: MutatorTiers): void {
  const lines = readmeLines(readmePath);

  it('lists the mutators of each tier in the README table of that tier, in roster order', () => {
    assert.deepEqual(
      perTier((key) => tableNames(lines, tierHeadings[key])),
      perTier((key) => tiers[key].map(({ name }) => name)),
    );
  });

  it('says None under the heading of each tier that has no mutator, and only there', () => {
    assert.deepEqual(
      perTier((key) => saysNone(lines, tierHeadings[key])),
      perTier((key) => tiers[key].length === 0),
    );
  });
}
