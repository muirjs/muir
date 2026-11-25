import {
  muirMoiraMutatorsArgumentOf,
  muirMoiraMutatorsCallTypes,
  muirMoiraMutatorsFindProperty,
  muirMoiraMutatorsMemberNameOf,
} from './ast.ts';
import type { MuirMoiraMutatorsSampledMutator } from './install.ts';
import {
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsIsRecord,
} from './is-record.ts';

/** A literal that a mutator may swap: the node, and the value that tells it from another literal of the same key. */
export interface MuirMoiraMutatorsSite {
  readonly key: string;
  readonly value: string;
  readonly node: unknown;
}

/** Reads the site of a call expression, when the call has one. */
export type MuirMoiraMutatorsSiteReader = (
  call: unknown,
) => MuirMoiraMutatorsSite | undefined;

/** True when two site values must never replace each other. */
type Excludes = (one: string, other: string) => boolean;

/** The Babel types a same-file swap uses. */
export interface MuirMoiraMutatorsSwapTypes {
  cloneNode(node: unknown): unknown;
}

export interface MuirMoiraMutatorsSwapMutator<TName extends string>
  extends MuirMoiraMutatorsSampledMutator {
  readonly name: TName;
  mutate(path: unknown, t: MuirMoiraMutatorsSwapTypes): Iterable<unknown>;
}

export function muirMoiraMutatorsSwapMutator<const TName extends string>(
  name: TName,
  sample: string,
  read: MuirMoiraMutatorsSiteReader,
  excludes: Excludes = (one, other) => one === other,
): MuirMoiraMutatorsSwapMutator<TName> {
  const indexed = new WeakMap<
    object,
    ReadonlyMap<unknown, readonly unknown[]>
  >();

  return {
    name,
    sample,
    *mutate(path, t) {
      const program = programOf(path);

      if (!muirMoiraMutatorsIsRecord(program)) {
        return;
      }

      // Built on the first node this mutator is shown of the file: Program, the first node of a line range, or, for
      // MuirProteusStorybookTestInteractionTarget, its first site. Stryker places mutants on exit, so other mutators' mutants may
      // already stand in earlier statements; they copy the literals of sites unchanged, and no swap of this mutator
      // has been placed yet.
      const replacements =
        indexed.get(program) ??
        replacementsBySite(
          recordsIn(program).filter(isCall).map(read),
          excludes,
        );

      indexed.set(program, replacements);

      yield* (
        replacements.get(muirMoiraMutatorsFieldOf(path, 'node')) ?? []
      ).map((replacement) => t.cloneNode(replacement));
    },
  };
}

/**
 * What tells two literal values apart: a string literal and an expression-free template literal by their text, a
 * regex literal by pattern and flags. A string and a regex never compare equal.
 */
export function muirMoiraMutatorsLiteralValue(
  node: unknown,
): string | undefined {
  switch (muirMoiraMutatorsFieldOf(node, 'type')) {
    case 'StringLiteral':
    case 'TemplateLiteral': {
      const text = muirMoiraMutatorsLiteralText(node);

      return text === undefined ? undefined : `string:${text}`;
    }
    case 'RegExpLiteral':
      return `regex:/${String(muirMoiraMutatorsFieldOf(node, 'pattern'))}/${String(muirMoiraMutatorsFieldOf(node, 'flags'))}`;
    default:
      return undefined;
  }
}

/** The text of a string literal or of an expression-free template literal. */
export function muirMoiraMutatorsLiteralText(
  node: unknown,
): string | undefined {
  switch (muirMoiraMutatorsFieldOf(node, 'type')) {
    case 'StringLiteral': {
      const text = muirMoiraMutatorsFieldOf(node, 'value');

      return typeof text === 'string' ? text : undefined;
    }
    case 'TemplateLiteral': {
      const quasis = muirMoiraMutatorsFieldOf(node, 'quasis');
      const text = muirMoiraMutatorsFieldOf(
        muirMoiraMutatorsFieldOf(
          Array.isArray(quasis) ? quasis[0] : undefined,
          'value',
        ),
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

/**
 * The `name` of a call to one of the methods with a string-literal role, such as `getByRole('button', { name: 'Save'
 * })`; the role is the key, so the methods share replacements.
 */
export function muirMoiraMutatorsRoleSite(
  methods: readonly string[],
): MuirMoiraMutatorsSiteReader {
  return (call) => {
    const method = muirMoiraMutatorsMemberNameOf(
      muirMoiraMutatorsFieldOf(call, 'callee'),
    );
    const role = muirMoiraMutatorsArgumentOf(call, 0);
    const name = muirMoiraMutatorsFieldOf(
      muirMoiraMutatorsFindProperty(
        muirMoiraMutatorsArgumentOf(call, 1),
        'name',
      ),
      'value',
    );
    const value = muirMoiraMutatorsLiteralValue(name);

    return typeof method === 'string' &&
      methods.includes(method) &&
      muirMoiraMutatorsFieldOf(role, 'type') === 'StringLiteral' &&
      value !== undefined
      ? {
          key: `role:${muirMoiraMutatorsLiteralValue(role)}`,
          value,
          node: name,
        }
      : undefined;
  };
}

/** The first argument of a call to one of the methods; the method is the key. */
export function muirMoiraMutatorsFirstArgumentSite(
  methods: readonly string[],
): MuirMoiraMutatorsSiteReader {
  return (call) => {
    const method = muirMoiraMutatorsMemberNameOf(
      muirMoiraMutatorsFieldOf(call, 'callee'),
    );
    const argument = muirMoiraMutatorsArgumentOf(call, 0);
    const value = muirMoiraMutatorsLiteralValue(argument);

    return typeof method === 'string' &&
      methods.includes(method) &&
      value !== undefined
      ? { key: method, value, node: argument }
      : undefined;
  };
}

function isCall(node: unknown): boolean {
  return muirMoiraMutatorsCallTypes.includes(
    muirMoiraMutatorsFieldOf(node, 'type'),
  );
}

function replacementsBySite(
  found: readonly (MuirMoiraMutatorsSite | undefined)[],
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
  const start = muirMoiraMutatorsFieldOf(node, 'start');

  return typeof start === 'number' ? start : 0;
}

function isReplacementFor(
  site: MuirMoiraMutatorsSite,
  excludes: Excludes,
): (other: MuirMoiraMutatorsSite) => boolean {
  return ({ key, value }) => key === site.key && !excludes(value, site.value);
}

function programOf(path: unknown): unknown {
  return muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsFieldOf(
      muirMoiraMutatorsFieldOf(muirMoiraMutatorsFieldOf(path, 'hub'), 'file'),
      'ast',
    ),
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
      .filter(muirMoiraMutatorsIsRecord)
      .flatMap(recordsIn),
  ];
}
