import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parse } from '@babel/parser';

import { field, list } from '../src/node-field.ts';
import {
  childNodes,
  descendants,
  equivalent,
  indexTree,
  isFunction,
  isNode,
  memberName,
} from '../src/node-tree.ts';
import { programOf } from './support/parse-module.ts';

describe('isNode', () => {
  it('is false for an object whose type is not a string', () => {
    assert.equal(isNode({ type: 1 }), false);
  });
});

describe('isFunction', () => {
  it('is true for a private class method', () => {
    const method = descendants(programOf('class A { #m() {} }')).find(
      (node) => field(node, 'type') === 'ClassPrivateMethod',
    );

    assert.equal(isFunction(method), true);
  });
});

describe('childNodes', () => {
  it('leaves out the comments of a node', () => {
    const [statement] = list(field(programOf('// note', 'a;'), 'body'));

    assert.deepEqual(childNodes(statement), [field(statement, 'expression')]);
  });
});

describe('descendants', () => {
  it('gives the node and every node below it', () => {
    const [statement] = list(field(programOf('a;'), 'body'));

    assert.deepEqual(descendants(statement), [
      statement,
      field(statement, 'expression'),
    ]);
  });
});

describe('memberName', () => {
  it('gives undefined for a computed member whose key is a bigint, whose value Babel holds as a string', () => {
    const [statement] = list(field(programOf('a[1n];'), 'body'));

    assert.equal(memberName(field(statement, 'expression')), undefined);
  });

  it('gives undefined for a JSX member, whose key is a JSX identifier', () => {
    const member = descendants(
      parse('<a.b />;', { plugins: ['jsx'] }).program,
    ).find((node) => field(node, 'type') === 'JSXMemberExpression');

    assert.equal(memberName(member), undefined);
  });
});

describe('indexTree', () => {
  it('gives the parent of a node', () => {
    const program = programOf('call(a);');
    const [statement] = list(field(program, 'body'));

    assert.equal(
      indexTree(program).parentOf(field(statement, 'expression')),
      statement,
    );
  });

  it('gives the ancestors of a node, nearest first, up to the program', () => {
    const program = programOf('call(a);');
    const [statement] = list(field(program, 'body'));

    assert.deepEqual(
      indexTree(program).ancestors(field(statement, 'expression')),
      [statement, program],
    );
  });

  it('gives the statement list a statement stands in as the file was when it was indexed', () => {
    const program = programOf('first();', 'second();');
    const body = [...program.body];
    const tree = indexTree(program);

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
    const [switchCase] = list(field(program.body[0], 'cases'));
    const consequent = list(field(switchCase, 'consequent'));

    assert.deepEqual(indexTree(program).listOf(consequent[1]), consequent);
  });

  it("gives a static block's statements as the list a statement in the block stands in", () => {
    const program = programOf(
      'class A {',
      '  static {',
      '    first();',
      '  }',
      '}',
    );
    const block = descendants(program).find(
      (node) => field(node, 'type') === 'StaticBlock',
    );
    const body = list(field(block, 'body'));

    assert.deepEqual(indexTree(program).listOf(body[0]), body);
  });

  it("gives a namespace's statements as the list a statement in the namespace stands in", () => {
    const program = programOf('namespace N {', '  first();', '}');
    const block = descendants(program).find(
      (node) => field(node, 'type') === 'TSModuleBlock',
    );
    const body = list(field(block, 'body'));

    assert.deepEqual(indexTree(program).listOf(body[0]), body);
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
        statements.findIndex((other) => equivalent(other, statement)),
      ),
      [
        0, 0, 2, 3, 4, 4, 6, 7, 7, 9, 10, 11, 10, 13, 14, 14, 14, 17, 18, 19,
        20, 21, 20, 23, 23, 25, 25, 27, 28, 29, 30, 30, 32, 33, 34, 33,
      ],
    );
  });
});
