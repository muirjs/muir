import { callTypes } from './ast.ts';
import type { SampledMutator } from './install.ts';
import { fieldOf, isRecord } from './is-record.ts';

/** A literal that a mutator may swap: the node, and the value that tells it from another literal of the same key. */
export interface Site {
  readonly key: string;
  readonly value: string;
  readonly node: unknown;
}

/** Reads the site of a call expression, when the call has one. */
export type SiteReader = (call: unknown) => Site | undefined;

/** True when two site values must never replace each other. */
type Excludes = (one: string, other: string) => boolean;

/** The Babel types a same-file swap uses. */
export interface SwapTypes {
  cloneNode(node: unknown): unknown;
}

export interface SwapMutator<TName extends string> extends SampledMutator {
  readonly name: TName;
  mutate(path: unknown, t: SwapTypes): Iterable<unknown>;
}

export function swapMutator<const TName extends string>(
  name: TName,
  sample: string,
  read: SiteReader,
  excludes: Excludes = (one, other) => one === other,
): SwapMutator<TName> {
  const indexed = new WeakMap<
    object,
    ReadonlyMap<unknown, readonly unknown[]>
  >();

  return {
    name,
    sample,
    *mutate(path, t) {
      const program = programOf(path);

      if (!isRecord(program)) {
        return;
      }

      // Built on the first node Stryker shows of this file: Program for a whole file, the first node inside the
      // range for a line range. Either way no mutant has been placed in the file yet.
      const replacements =
        indexed.get(program) ??
        replacementsBySite(
          recordsIn(program).filter(isCall).map(read),
          excludes,
        );

      indexed.set(program, replacements);

      yield* (replacements.get(fieldOf(path, 'node')) ?? []).map(
        (replacement) => t.cloneNode(replacement),
      );
    },
  };
}

/**
 * What tells two literal values apart: a string literal and an expression-free template literal by their text, a
 * regex literal by pattern and flags. A string and a regex never compare equal.
 */
export function literalValue(node: unknown): string | undefined {
  switch (fieldOf(node, 'type')) {
    case 'StringLiteral':
    case 'TemplateLiteral': {
      const text = literalText(node);

      return text === undefined ? undefined : `string:${text}`;
    }
    case 'RegExpLiteral':
      return `regex:/${String(fieldOf(node, 'pattern'))}/${String(fieldOf(node, 'flags'))}`;
    default:
      return undefined;
  }
}

/** The text of a string literal or of an expression-free template literal. */
export function literalText(node: unknown): string | undefined {
  switch (fieldOf(node, 'type')) {
    case 'StringLiteral': {
      const text = fieldOf(node, 'value');

      return typeof text === 'string' ? text : undefined;
    }
    case 'TemplateLiteral': {
      const quasis = fieldOf(node, 'quasis');
      const text = fieldOf(
        fieldOf(Array.isArray(quasis) ? quasis[0] : undefined, 'value'),
        'cooked',
      );

      return Array.isArray(quasis) &&
        quasis.length === 1 &&
        typeof text === 'string'
        ? text
        : undefined;
    }
    default:
      return undefined;
  }
}

function isCall(node: unknown): boolean {
  return callTypes.includes(fieldOf(node, 'type'));
}

function replacementsBySite(
  found: readonly (Site | undefined)[],
  excludes: Excludes,
): ReadonlyMap<unknown, readonly unknown[]> {
  const sites = found
    .filter((site) => site !== undefined)
    .toSorted((one, other) => startOf(one.node) - startOf(other.node));

  return new Map(
    sites.map((site, index) => [
      site.node,
      [
        sites.slice(0, index).findLast(isReplacementFor(site, excludes)),
        sites.slice(index + 1).find(isReplacementFor(site, excludes)),
      ]
        .filter((neighbour) => neighbour !== undefined)
        .filter(
          (neighbour, at, all) =>
            all.findIndex(({ value }) => excludes(value, neighbour.value)) ===
            at,
        )
        .map((neighbour) => neighbour.node),
    ]),
  );
}

function startOf(node: unknown): number {
  const start = fieldOf(node, 'start');

  return typeof start === 'number' ? start : 0;
}

function isReplacementFor(
  site: Site,
  excludes: Excludes,
): (other: Site) => boolean {
  return ({ key, value }) => key === site.key && !excludes(value, site.value);
}

function programOf(path: unknown): unknown {
  return fieldOf(
    fieldOf(fieldOf(fieldOf(path, 'hub'), 'file'), 'ast'),
    'program',
  );
}

/** `record` and every record under it, depth first. */
function recordsIn(record: object): readonly object[] {
  return [
    record,
    ...Object.values(record)
      .flatMap((value): readonly unknown[] =>
        Array.isArray(value) ? value : [value],
      )
      .filter(isRecord)
      .flatMap(recordsIn),
  ];
}
