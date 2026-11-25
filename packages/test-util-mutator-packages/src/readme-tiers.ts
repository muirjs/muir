import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';

type Tier = readonly { readonly name: string }[];

export interface MuirMutatorTiers {
  readonly defaults: Tier;
  readonly optIn: Tier;
  readonly experimental: Tier;
}

type TierKey = keyof MuirMutatorTiers;

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

/** What a package's README says about it beside its tiers: its name, its mutator names' prefix, and Stryker's built-ins. */
export interface MuirReadmeFacts {
  readonly packageName: string;
  /** The prefix of the package's mutator names, as in `MuirMsw`. */
  readonly prefix: string;
  /** Whether installing the package keeps Stryker's built-in mutators on or turns them off. */
  readonly builtIns: 'on' | 'off';
  readonly builtInCount: number;
}

function readmeLines(readmePath: string): readonly string[] {
  return readFileSync(readmePath, 'utf8').split(/\r?\n/);
}

function countOf(count: number, singular: string, plural: string): string {
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

const reasonsHeading = '### Why a mutator is opt-in or experimental';

/** The rows of the reasons table as `[name, why, what would move it]`, from table rows that name a mutator. */
function reasonRows(lines: readonly string[]): readonly (readonly string[])[] {
  return sectionLines(lines, reasonsHeading).flatMap((line) =>
    /^\| `\w+` +\|/.test(line)
      ? [
          line
            .split('|')
            .slice(1, -1)
            .map((cell) => cell.trim()),
        ]
      : [],
  );
}

/**
 * Registers the test that the README's reasons table gives, for each opt-in and experimental mutator in roster order,
 * why it is in its tier and what would move it, and that a package without such mutators has no reasons table.
 * `register` takes the place of `it` in this package's own tests.
 */
export function muirTestReadmeTierReasons(
  readmePath: string,
  { optIn, experimental }: MuirMutatorTiers,
  register: (name: string, check: () => void) => unknown = it,
): void {
  const lines = readmeLines(readmePath);

  register(
    'gives why each opt-in and experimental mutator is in its tier and what would move it, in roster order',
    () => {
      const names = [...optIn, ...experimental].map(({ name }) => name);

      if (names.length === 0) {
        assert.ok(
          !lines.includes(reasonsHeading),
          'no reasons table without opt-in or experimental mutators',
        );

        return;
      }

      const rows = reasonRows(lines);

      assert.deepEqual(
        rows.map(([name]) => name),
        names.map((name) => `\`${name}\``),
      );
      assert.ok(
        rows.every(
          (cells) => cells.length === 3 && cells.every((cell) => cell !== ''),
        ),
        'every row has a reason and what would move it',
      );
    },
  );
}

/**
 * Registers the tests that the README's opening and its default install line give the size of each tier, that each
 * tier's README table lists that tier's mutators in roster order, and that "None." stands under the heading of each
 * empty tier and only there. `register` takes the place of `it` in this package's own tests.
 */
export function muirTestReadmeTiers(
  readmePath: string,
  tiers: MuirMutatorTiers,
  { packageName, prefix, builtIns, builtInCount }: MuirReadmeFacts,
  register: (name: string, check: () => void) => unknown = it,
): void {
  const lines = readmeLines(readmePath);

  register(
    'gives the size of each tier in the opening counts and in the default install line',
    () => {
      const { defaults, optIn, experimental } = tiers;
      const total = defaults.length + optIn.length + experimental.length;
      // The README as one line, so a sentence the file wraps still matches.
      const readme = lines.join(' ');
      const [opening, installLine] =
        builtIns === 'on'
          ? [
              `keeps Stryker's ${builtInCount} built-in mutators on`,
              `${packageName}: ${defaults.length} ${prefix} mutators on, beside Stryker's built-in mutators.`,
            ]
          : [
              `turns Stryker's ${builtInCount} built-in mutators off`,
              `${packageName}: Stryker's ${builtInCount} built-in mutators are off for every file in this run; ${defaults.length} ${prefix} mutators on.`,
            ];

      assert.ok(
        readme.includes(
          `${opening} and adds ${total} of its own: ${countOf(defaults.length, 'runs', 'run')} by default, ${countOf(optIn.length, 'is', 'are')} opt-in and ${countOf(experimental.length, 'is', 'are')} experimental.`,
        ),
        'the opening counts',
      );
      assert.ok(readme.includes(installLine), 'the default install line');
    },
  );

  register(
    'lists the mutators of each tier in the README table of that tier, in roster order',
    () => {
      assert.deepEqual(
        perTier((key) => tableNames(lines, tierHeadings[key])),
        perTier((key) => tiers[key].map(({ name }) => name)),
      );
    },
  );

  register(
    'says None under the heading of each tier that has no mutator, and only there',
    () => {
      assert.deepEqual(
        perTier((key) => saysNone(lines, tierHeadings[key])),
        perTier((key) => tiers[key].length === 0),
      );
    },
  );
}
