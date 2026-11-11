import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parse } from '@babel/parser';

import { csfFile, csfShapes, topLevelBindings } from '../src/csf.ts';
import { field, list } from '../src/node-field.ts';

function writtenNames(...lines: readonly string[]): readonly unknown[] {
  const body = list(
    field(
      parse(lines.join('\n'), {
        sourceType: 'module',
        plugins: ['typescript'],
      }),
      'program',
      'body',
    ),
  );

  return [...csfFile(body, topLevelBindings(body)).written];
}

describe('csfFile written', () => {
  it("leaves out a name that only a story factory call's argument reads", () => {
    assert.equal(
      writtenNames(
        "import preview from '../.storybook/preview';",
        'const shared = { a: 1 };',
        'const meta = preview.meta({});',
        'export const Primary = meta.story({ args: shared });',
      ).includes('shared'),
      false,
    );
  });

  it("holds a name a story factory call's argument reads when the file writes through the story's input", () => {
    assert.equal(
      writtenNames(
        "import preview from '../.storybook/preview';",
        'const shared = { a: 1 };',
        'const meta = preview.meta({});',
        'export const Primary = meta.story({ args: shared });',
        'Primary.input.args.a = 2;',
      ).includes('shared'),
      true,
    );
  });

  it('leaves out a story that only a spread of its args in another story reads', () => {
    assert.equal(
      writtenNames(
        "export default { title: 'a/b' };",
        'export const Base = { args: { a: 1 } };',
        'export const Primary = { args: { ...Base.args, b: 2 } };',
      ).includes('Base'),
      false,
    );
  });

  it('leaves out the options a .test() call that Storybook indexes names', () => {
    assert.equal(
      writtenNames(
        "import preview from '../.storybook/preview';",
        'const meta = preview.meta({});',
        'export const Primary = meta.story({});',
        'const options = { args: { a: 1 } };',
        "Primary.test('t', options, async () => {});",
      ).includes('options'),
      false,
    );
  });

  it('leaves out the base story of an .extend() call', () => {
    assert.equal(
      writtenNames(
        "import preview from '../.storybook/preview';",
        'const meta = preview.meta({});',
        'export const Primary = meta.story({});',
        'export const Small = Primary.extend({});',
      ).includes('Primary'),
      false,
    );
  });

  it('leaves out a name that is also the key of a shorthand property', () => {
    assert.equal(
      writtenNames(
        "export default { title: 'a/b' };",
        'const args = { a: 1 };',
        'export const Primary = { args };',
      ).includes('args'),
      false,
    );
  });
});

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
