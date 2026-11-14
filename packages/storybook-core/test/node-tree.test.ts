import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { field, list } from '../src/node-field.ts';
import { equivalenceIds, equivalent, indexTree } from '../src/node-tree.ts';
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

describe('equivalenceIds', () => {
  it('gives two statements one id exactly when they are equivalent, positions and comments aside', () => {
    const program = programOf(
      "await expect(canvas.getByRole('a')).toBeVisible();",
      "await expect(canvas.getByRole('b')).toBeVisible();",
      "/* again */ await expect(canvas.getByRole( 'a' )).toBeVisible();",
      "await expect(canvas.getByRole('a')).not.toBeVisible();",
    );
    const ids = equivalenceIds(program);
    const statements = list(field(program, 'body'));

    assert.deepEqual(
      statements.flatMap((first) =>
        statements.map(
          (second) =>
            (ids.get(first) === ids.get(second)) === equivalent(first, second),
        ),
      ),
      Array.from({ length: 16 }, () => true),
    );
    assert.equal(ids.get(statements[0]), ids.get(statements[2]));
    assert.notEqual(ids.get(statements[0]), ids.get(statements[1]));
  });
});
