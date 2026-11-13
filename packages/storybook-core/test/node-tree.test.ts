import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { field, list } from '../src/node-field.ts';
import { indexTree } from '../src/node-tree.ts';
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
