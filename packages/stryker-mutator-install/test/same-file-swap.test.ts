import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fieldOf } from '../src/is-record.ts';
import { swapMutator, type SiteReader } from '../src/same-file-swap.ts';

interface Literal {
  readonly type: 'Literal';
  readonly start: number;
  readonly value: string;
  readonly key: string;
}

function literal(start: number, value: string, key = 'kind'): Literal {
  return { type: 'Literal', start, value, key };
}

/** A program of one call per literal, each taking the literal as its argument. */
function programOf(literals: readonly Literal[]) {
  return {
    type: 'Program',
    body: literals.map((argument) => ({
      type: 'CallExpression',
      argument,
    })),
  };
}

const readArgument: SiteReader = (call) => {
  const argument = fieldOf(call, 'argument');
  const value = fieldOf(argument, 'value');
  const key = fieldOf(argument, 'key');

  return typeof value === 'string' && typeof key === 'string'
    ? { key, value, node: argument }
    : undefined;
};

const t = { cloneNode: (node: unknown) => ({ clone: node }) };

function replacementsOf(
  literals: readonly Literal[],
  site: Literal,
  options: {
    readonly read?: SiteReader;
    readonly excludes?: (one: string, other: string) => boolean;
  } = {},
): readonly unknown[] {
  const swap = swapMutator(
    'Swap',
    '',
    options.read ?? readArgument,
    options.excludes,
  );
  const program = programOf(literals);

  return [
    ...swap.mutate({ hub: { file: { ast: { program } } }, node: site }, t),
  ];
}

describe('swapMutator', () => {
  it('replaces a site with the nearest distinct value of its key on each side, cloned', () => {
    const before = literal(0, 'a');
    const nearer = literal(10, 'b');
    const site = literal(20, 'c');
    const same = literal(30, 'c');
    const after = literal(40, 'd');
    const farther = literal(50, 'e');

    assert.deepEqual(
      replacementsOf([before, nearer, site, same, after, farther], site),
      [{ clone: nearer }, { clone: after }],
    );
  });

  it('orders the sites by their start, not by where the tree holds them', () => {
    const site = literal(20, 'b');
    const before = literal(10, 'a');
    const after = literal(30, 'c');

    assert.deepEqual(replacementsOf([after, site, before], site), [
      { clone: before },
      { clone: after },
    ]);
  });

  it('takes no value of another key', () => {
    const site = literal(0, 'a');

    assert.deepEqual(
      replacementsOf([site, literal(10, 'b', 'other')], site),
      [],
    );
  });

  it('skips the values that excludes rules out for the site', () => {
    const site = literal(0, 'Save');
    const plural = literal(10, 'Saves');
    const other = literal(20, 'Cancel');

    assert.deepEqual(
      replacementsOf([site, plural, other], site, {
        excludes: (one, other) =>
          one.startsWith(other) || other.startsWith(one),
      }),
      [{ clone: other }],
    );
  });

  it('gives a value found on both sides once', () => {
    const before = literal(0, 'a');
    const site = literal(10, 'b');
    const after = literal(20, 'a');

    assert.deepEqual(replacementsOf([before, site, after], site), [
      { clone: before },
    ]);
  });

  it('gives nothing for a node that is no site', () => {
    const site = literal(0, 'a');

    assert.deepEqual(
      replacementsOf([site, literal(10, 'b')], literal(0, 'a')),
      [],
    );
  });

  it('reads the calls of a program once, however many nodes it is shown', () => {
    const first = literal(0, 'a');
    const second = literal(10, 'b');
    const program = programOf([first, second]);
    let reads = 0;
    const swap = swapMutator('Swap', '', (call) => {
      reads += 1;

      return readArgument(call);
    });
    const hub = { file: { ast: { program } } };

    const replacements = [first, second].flatMap((node) => [
      ...swap.mutate({ hub, node }, t),
    ]);

    assert.deepEqual(replacements, [{ clone: second }, { clone: first }]);
    assert.equal(reads, 2);
  });

  it('gives nothing for a path outside a file', () => {
    const swap = swapMutator('Swap', '', readArgument);

    assert.deepEqual([...swap.mutate({ node: literal(0, 'a') }, t)], []);
  });
});
