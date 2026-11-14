import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parse } from '@babel/parser';

import { field, list } from '../src/node-field.ts';
import { equivalent, indexTree } from '../src/node-tree.ts';
import { programOf } from './support/parse-module.ts';

describe('indexTree', () => {
  it('gives the parent of a node', () => {
    const program = programOf('call(a);');
    const [statement] = list(field(program, 'body'));

    assert.equal(
      indexTree(program).parentOf(field(statement, 'expression')),
      statement,
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
