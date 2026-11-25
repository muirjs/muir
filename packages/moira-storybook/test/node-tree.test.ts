import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parse } from '@babel/parser';

import {
  muirMoiraStorybookField,
  muirMoiraStorybookList,
} from '../src/node-field.ts';
import {
  muirMoiraStorybookChildNodes,
  muirMoiraStorybookDescendants,
  muirMoiraStorybookEquivalenceTokens,
  muirMoiraStorybookEquivalent,
  muirMoiraStorybookIndexTree,
  muirMoiraStorybookIsFunction,
  muirMoiraStorybookIsNode,
  muirMoiraStorybookMemberName,
} from '../src/node-tree.ts';
import { programOf } from './support/parse-module.ts';

describe('isNode', () => {
  it('is false for an object whose type is not a string', () => {
    assert.equal(muirMoiraStorybookIsNode({ type: 1 }), false);
  });
});

describe('isFunction', () => {
  it('is true for a private class method', () => {
    const method = muirMoiraStorybookDescendants(
      programOf('class A { #m() {} }'),
    ).find(
      (node) => muirMoiraStorybookField(node, 'type') === 'ClassPrivateMethod',
    );

    assert.equal(muirMoiraStorybookIsFunction(method), true);
  });
});

describe('childNodes', () => {
  it('leaves out the comments of a node', () => {
    const [statement] = muirMoiraStorybookList(
      muirMoiraStorybookField(programOf('// note', 'a;'), 'body'),
    );

    assert.deepEqual(muirMoiraStorybookChildNodes(statement), [
      muirMoiraStorybookField(statement, 'expression'),
    ]);
  });
});

describe('descendants', () => {
  it('gives the node and every node below it', () => {
    const [statement] = muirMoiraStorybookList(
      muirMoiraStorybookField(programOf('a;'), 'body'),
    );

    assert.deepEqual(muirMoiraStorybookDescendants(statement), [
      statement,
      muirMoiraStorybookField(statement, 'expression'),
    ]);
  });
});

describe('memberName', () => {
  it('gives undefined for a computed member whose key is a bigint, whose value Babel holds as a string', () => {
    const [statement] = muirMoiraStorybookList(
      muirMoiraStorybookField(programOf('a[1n];'), 'body'),
    );

    assert.equal(
      muirMoiraStorybookMemberName(
        muirMoiraStorybookField(statement, 'expression'),
      ),
      undefined,
    );
  });

  it('gives undefined for a JSX member, whose key is a JSX identifier', () => {
    const member = muirMoiraStorybookDescendants(
      parse('<a.b />;', { plugins: ['jsx'] }).program,
    ).find(
      (node) => muirMoiraStorybookField(node, 'type') === 'JSXMemberExpression',
    );

    assert.equal(muirMoiraStorybookMemberName(member), undefined);
  });
});

describe('indexTree', () => {
  it('gives the parent of a node', () => {
    const program = programOf('call(a);');
    const [statement] = muirMoiraStorybookList(
      muirMoiraStorybookField(program, 'body'),
    );

    assert.equal(
      muirMoiraStorybookIndexTree(program).parentOf(
        muirMoiraStorybookField(statement, 'expression'),
      ),
      statement,
    );
  });

  it('gives the ancestors of a node, nearest first, up to the program', () => {
    const program = programOf('call(a);');
    const [statement] = muirMoiraStorybookList(
      muirMoiraStorybookField(program, 'body'),
    );

    assert.deepEqual(
      muirMoiraStorybookIndexTree(program).ancestors(
        muirMoiraStorybookField(statement, 'expression'),
      ),
      [statement, program],
    );
  });

  it('gives the statement list a statement stands in as the file was when it was indexed', () => {
    const program = programOf('first();', 'second();');
    const body = [...program.body];
    const tree = muirMoiraStorybookIndexTree(program);

    program.body.splice(0, 1);

    assert.deepEqual(tree.listOf(body[1]), body);
  });

  it("gives a switch case's statements as the list a statement in the case stands in", () => {
    const program = programOf(
      'switch (a) {',
      '  case 1:',
      '    first();',
      '    second();',
      '}',
    );
    const [switchCase] = muirMoiraStorybookList(
      muirMoiraStorybookField(program.body[0], 'cases'),
    );
    const consequent = muirMoiraStorybookList(
      muirMoiraStorybookField(switchCase, 'consequent'),
    );

    assert.deepEqual(
      muirMoiraStorybookIndexTree(program).listOf(consequent[1]),
      consequent,
    );
  });

  it("gives a static block's statements as the list a statement in the block stands in", () => {
    const program = programOf(
      'class A {',
      '  static {',
      '    first();',
      '  }',
      '}',
    );
    const block = muirMoiraStorybookDescendants(program).find(
      (node) => muirMoiraStorybookField(node, 'type') === 'StaticBlock',
    );
    const body = muirMoiraStorybookList(muirMoiraStorybookField(block, 'body'));

    assert.deepEqual(
      muirMoiraStorybookIndexTree(program).listOf(body[0]),
      body,
    );
  });

  it("gives a namespace's statements as the list a statement in the namespace stands in", () => {
    const program = programOf('namespace N {', '  first();', '}');
    const block = muirMoiraStorybookDescendants(program).find(
      (node) => muirMoiraStorybookField(node, 'type') === 'TSModuleBlock',
    );
    const body = muirMoiraStorybookList(muirMoiraStorybookField(block, 'body'));

    assert.deepEqual(
      muirMoiraStorybookIndexTree(program).listOf(body[0]),
      body,
    );
  });
});

describe('equivalent', () => {
  it('pairs each statement with the first equivalent one, whatever their positions, spacing, comments and quotes', () => {
    const statements = parse(
      [
        "await expect(canvas.getByRole('a')).toBeVisible();",
        "/* again */ await expect(canvas.getByRole( 'a' )).toBeVisible();",
        "await expect(canvas.getByRole('b')).toBeVisible();",
        "await expect(canvas.getByRole('a')).not.toBeVisible();",
        'f(`a${x}b`);',
        'f(`a${ x }b`);',
        'f(`a${y}b`);',
        'f(/ab+/g);',
        'f(/ab+/g);',
        'f(/ab+/i);',
        'f(10n);',
        'f(0xan);',
        'f(10n);',
        'f(-0);',
        'f(0);',
        'f(0.0);',
        'f(0x0);',
        'f(1e400);',
        'f(Infinity);',
        'f(NaN);',
        'f(a?.b);',
        'f(a.b);',
        'f(a?.b);',
        "f('a');",
        'f("a");',
        'f((a));',
        'f(a);',
        'f([, a]);',
        'f([undefined, a]);',
        'f([null, a]);',
        'f(<b x="1" />);',
        'f(<b x="1"/>);',
        'f(<b x="2" />);',
        'f(a as T);',
        'f(a!);',
        'f(a as T);',
      ].join('\n'),
      { sourceType: 'module', plugins: ['typescript', 'jsx'] },
    ).program.body;
    assert.deepEqual(
      statements.map((statement) =>
        statements.findIndex((other) =>
          muirMoiraStorybookEquivalent(other, statement),
        ),
      ),
      [
        0, 0, 2, 3, 4, 4, 6, 7, 7, 9, 10, 11, 10, 13, 14, 14, 14, 17, 18, 19,
        20, 21, 20, 23, 23, 25, 25, 27, 28, 29, 30, 30, 32, 33, 34, 33,
      ],
    );
  });

  it('pairs calls whose empty argument lists hold different comments, as Babel does', () => {
    const [first, second] = muirMoiraStorybookList(
      muirMoiraStorybookField(programOf('f(/* a */);', 'f(/* b */);'), 'body'),
    );

    assert.equal(muirMoiraStorybookEquivalent(first, second), true);
  });
});

describe('equivalenceTokens', () => {
  it('gives each node outside the roots a token no other value shares, whatever the order of the calls', () => {
    const tokenOf = muirMoiraStorybookEquivalenceTokens([]);
    const tokens = [
      tokenOf({ type: 'A' }),
      tokenOf([]),
      tokenOf({ type: 'A' }),
      tokenOf([1]),
    ];

    assert.equal(new Set(tokens).size, tokens.length);
  });

  it('gives plain objects with the same fields in another order the same token', () => {
    const tokenOf = muirMoiraStorybookEquivalenceTokens([]);

    assert.equal(tokenOf({ a: 1, b: 2 }), tokenOf({ b: 2, a: 1 }));
  });

  it('gives a plain object with an undefined field the token of the object without it', () => {
    const tokenOf = muirMoiraStorybookEquivalenceTokens([]);

    assert.equal(tokenOf({ a: 1, b: undefined }), tokenOf({ a: 1 }));
  });

  it('gives plain objects whose fields differ different tokens', () => {
    const tokenOf = muirMoiraStorybookEquivalenceTokens([]);

    assert.notEqual(tokenOf({ a: 1 }), tokenOf({ a: 2 }));
  });

  it('gives nodes with the same fields in another order the same token', () => {
    const first = { type: 'A', x: 1, y: 2 };
    const second = { type: 'A', y: 2, x: 1 };
    const tokenOf = muirMoiraStorybookEquivalenceTokens([first, second]);

    assert.equal(tokenOf(first), tokenOf(second));
  });

  it('gives a node with an undefined field the token of the node without it', () => {
    assert.equal(
      muirMoiraStorybookEquivalent({ type: 'A', x: undefined }, { type: 'A' }),
      true,
    );
  });

  it('gives two NaNs different tokens, as NaN is not equal to itself', () => {
    const tokenOf = muirMoiraStorybookEquivalenceTokens([]);

    assert.notEqual(tokenOf(NaN), tokenOf(NaN));
  });

  it('gives two functions with the same source different tokens', () => {
    const tokenOf = muirMoiraStorybookEquivalenceTokens([]);

    assert.notEqual(
      tokenOf(() => undefined),
      tokenOf(() => undefined),
    );
  });

  it('gives the same function the same token wherever it stands', () => {
    const tokenOf = muirMoiraStorybookEquivalenceTokens([]);
    const callback = (): undefined => undefined;

    assert.equal(tokenOf({ a: callback }), tokenOf({ a: callback }));
  });
});
