import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseSync, types } from '@babel/core';

import { muirTestEach } from '@muirjs/madrox-node-test';
import { muirMoiraMutatorsFieldOf } from '../src/is-record.ts';
import {
  muirMoiraMutatorsFirstArgumentSite,
  muirMoiraMutatorsLiteralText,
  muirMoiraMutatorsLiteralValue,
  muirMoiraMutatorsRoleSite,
  muirMoiraMutatorsSwapMutator,
  type MuirMoiraMutatorsSiteReader,
} from '../src/same-file-swap.ts';

/** `source` parsed as a TypeScript module. */
function parsed(source: string): types.File {
  const file = parseSync(source, {
    babelrc: false,
    configFile: false,
    filename: 'sample.ts',
    parserOpts: { plugins: ['typescript'] },
  });
  assert.ok(file);

  return file;
}

/** The expression of the statement `source`, assigned so that a string literal is no directive. */
function expressionOf(source: string): types.Expression {
  const [statement] = parsed(`value = ${source}`).program.body;
  assert.ok(statement?.type === 'ExpressionStatement');
  assert.ok(statement.expression.type === 'AssignmentExpression');

  return statement.expression.right;
}

describe('literalValue', () => {
  muirTestEach([
    ['a string literal', "'Save';", 'string:Save'],
    ['a template literal without expressions', '`Save`;', 'string:Save'],
    ['a template literal with an expression', '`Save ${n}`;', undefined],
    ['a regex literal', '/^Save$/iu;', 'regex:/^Save$/iu'],
    ['an identifier', 'Save;', undefined],
  ])('tells %s apart by', (_title, source, expected) => {
    assert.equal(muirMoiraMutatorsLiteralValue(expressionOf(source)), expected);
  });
});

describe('literalText', () => {
  muirTestEach([
    ['a string literal', "'Save';", 'Save'],
    ['a template literal without expressions', '`Save`;', 'Save'],
    ['a template literal with an expression', '`Save ${n}`;', undefined],
    ['a regex literal', '/Save/;', undefined],
  ])('reads the text of %s', (_title, source, expected) => {
    assert.equal(muirMoiraMutatorsLiteralText(expressionOf(source)), expected);
  });

  it('reads no text of a string literal whose value is no string, or a template literal without quasis', () => {
    assert.equal(
      muirMoiraMutatorsLiteralText({ type: 'StringLiteral', value: 1 }),
      undefined,
    );
    assert.equal(
      muirMoiraMutatorsLiteralText({ type: 'TemplateLiteral' }),
      undefined,
    );
  });

  it('reads no text of a tagged template whose escape has no cooked value', () => {
    const tagged = expressionOf('String.raw`\\u`;');
    assert.ok(tagged.type === 'TaggedTemplateExpression');

    assert.equal(muirMoiraMutatorsLiteralText(tagged.quasi), undefined);
  });
});

describe('roleSite', () => {
  const read = muirMoiraMutatorsRoleSite(['getByRole', 'findByRole']);

  it('reads the name of a call to one of the methods, keyed by the role', () => {
    const call = expressionOf(
      "screen.findByRole('button', { exact: true, name: 'Save' });",
    );
    const options = call.type === 'CallExpression' ? call.arguments[1] : null;
    const name =
      options?.type === 'ObjectExpression' ? options.properties[1] : null;

    assert.deepEqual(read(call), {
      key: 'role:string:button',
      value: 'string:Save',
      node: name?.type === 'ObjectProperty' ? name.value : null,
    });
  });

  muirTestEach([
    ['another method', "screen.getByText('button', { name: 'Save' });"],
    [
      'a role that is no string literal',
      "screen.getByRole(role, { name: 'Save' });",
    ],
    [
      'a role in a template literal',
      "screen.getByRole(`button`, { name: 'Save' });",
    ],
    ['a name that is no literal', "screen.getByRole('button', { name });"],
    ['no options', "screen.getByRole('button');"],
  ])('reads no site of a call with %s', (_title, source) => {
    assert.equal(read(expressionOf(source)), undefined);
  });
});

describe('firstArgumentSite', () => {
  const read = muirMoiraMutatorsFirstArgumentSite(['fill', 'type']);

  it('reads the first argument of a call to one of the methods, keyed by the method', () => {
    const call = expressionOf("input.type('Ada', { delay: 10 });");
    const [argument] = call.type === 'CallExpression' ? call.arguments : [];

    assert.deepEqual(read(call), {
      key: 'type',
      value: 'string:Ada',
      node: argument,
    });
  });

  muirTestEach([
    ['another method', "input.press('Ada');"],
    ['a first argument that is no literal', 'input.fill(name);'],
    ['a callee that is no member', "fill('Ada');"],
  ])('reads no site of a call to %s', (_title, source) => {
    assert.equal(read(expressionOf(source)), undefined);
  });
});

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

const readArgument: MuirMoiraMutatorsSiteReader = (call) => {
  const argument = muirMoiraMutatorsFieldOf(call, 'argument');
  const value = muirMoiraMutatorsFieldOf(argument, 'value');
  const key = muirMoiraMutatorsFieldOf(argument, 'key');

  return typeof value === 'string' && typeof key === 'string'
    ? { key, value, node: argument }
    : undefined;
};

const t = { cloneNode: (node: unknown) => ({ clone: node }) };

function replacementsOf(
  literals: readonly Literal[],
  site: Literal,
  options: {
    readonly read?: MuirMoiraMutatorsSiteReader;
    readonly excludes?: (one: string, other: string) => boolean;
  } = {},
): readonly unknown[] {
  const swap = muirMoiraMutatorsSwapMutator(
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
    const swap = muirMoiraMutatorsSwapMutator('Swap', '', (call) => {
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
    const swap = muirMoiraMutatorsSwapMutator('Swap', '', readArgument);

    assert.deepEqual([...swap.mutate({ node: literal(0, 'a') }, t)], []);
  });

  it('finds the sites of a parsed file, under statements and inside other calls', () => {
    const ast = parsed(
      "await input.fill('Ada');\nexpect(await input.fill('Grace')).toBe(true);",
    );
    const swap = muirMoiraMutatorsSwapMutator(
      'Swap',
      '',
      muirMoiraMutatorsFirstArgumentSite(['fill']),
    );
    const literals: types.StringLiteral[] = [];
    types.traverseFast(ast.program, (node) => {
      if (node.type === 'StringLiteral') {
        literals.push(node);
      }
    });
    const [ada, grace] = literals;

    assert.deepEqual(
      [...swap.mutate({ hub: { file: { ast } }, node: ada }, types)],
      [types.cloneNode(grace)],
    );
  });
});
