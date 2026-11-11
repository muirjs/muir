import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parse } from '@babel/parser';

import { csfShapes } from '../src/csf.ts';
import { field } from '../src/node-field.ts';

describe('csfShapes', () => {
  it('reads a parenthesized story object when the parser keeps parentheses as nodes', () => {
    const shapes = csfShapes(
      parse(
        "export default { title: 'a/b' };\nexport const A = ({ args: {} });",
        {
          sourceType: 'module',
          createParenthesizedExpressions: true,
        },
      ).program,
    );

    assert.deepEqual(
      [...shapes.literalContainers].map((node) => field(node, 'type')),
      ['ObjectExpression'],
    );
  });

  describe('.test() calls with and without options', () => {
    const program = parse(
      "import preview from '../.storybook/preview';\n" +
        "const meta = preview.meta({ title: 'a/b' });\n" +
        'export const A = meta.story({});\n' +
        "A.test('with', { args: {} }, () => {});\n" +
        "A.test('plain', () => {});\n",
      { sourceType: 'module' },
    ).program;
    const [, , , withOptions, plain] = program.body;
    const shapes = csfShapes(program);

    it('lists only the statement whose call has options', () => {
      assert.deepEqual([...shapes.testStatementsWithOptions], [withOptions]);
    });

    it('counts the test function of a call with options as test code, but not its statement', () => {
      const testFunction = field(withOptions, 'expression', 'arguments', '2');

      assert.equal(shapes.testCode.has(testFunction), true);
      assert.equal(shapes.testCode.has(withOptions), false);
      assert.equal(shapes.testCode.has(plain), true);
    });
  });
});
