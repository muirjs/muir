import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parse } from '@babel/parser';

import { csfFile, csfShapes, topLevelBindings } from '../src/csf.ts';
import { field, list } from '../src/node-field.ts';

function fileOf(...lines: readonly string[]) {
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

  return csfFile(body, topLevelBindings(body));
}

function writtenNames(...lines: readonly string[]): readonly unknown[] {
  return [...fileOf(...lines).written];
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

  it('leaves out a name a member assignment assigns', () => {
    assert.equal(
      writtenNames(
        "export default { title: 'a/b' };",
        'const assigned = async () => {};',
        'export const A = {};',
        'A.play = assigned;',
      ).includes('assigned'),
      false,
    );
  });

  it('leaves out a story that shares only a string constant with a name the file hands on', () => {
    assert.equal(
      writtenNames(
        "import { mutate } from './mutate';",
        "const ROUTE = '/a';",
        "const meta = { title: 'a/b', parameters: { routePath: ROUTE } };",
        'mutate(meta);',
        'export default meta;',
        'export const A = { parameters: { routePath: ROUTE } };',
      ).includes('A'),
      false,
    );
  });

  ['1', 'true', 'null', '1n', '`/a`'].forEach((literal) => {
    it(`leaves out a story that shares only the constant ${literal} with a name the file hands on`, () => {
      assert.equal(
        writtenNames(
          "import { mutate } from './mutate';",
          `const ROUTE = ${literal};`,
          "const meta = { title: 'a/b', parameters: { routePath: ROUTE } };",
          'mutate(meta);',
          'export default meta;',
          'export const A = { parameters: { routePath: ROUTE } };',
        ).includes('A'),
        false,
      );
    });
  });

  it('holds a story that the body of an object method hands on', () => {
    assert.equal(
      writtenNames(
        "import { mutate } from './mutate';",
        "export default { title: 'a/b' };",
        'export const B = { args: { a: 1 } };',
        'export const A = { play() { mutate(B); } };',
      ).includes('B'),
      true,
    );
  });

  it('holds a story that a computed key hands on', () => {
    assert.equal(
      writtenNames(
        "import { keyOf } from './key-of';",
        "export default { title: 'a/b' };",
        'export const B = { args: { a: 1 } };',
        'export const A = { args: { [keyOf(B)]: 1 } };',
      ).includes('B'),
      true,
    );
  });

  it('leaves out a name assigned to a member when the file writes only below other members', () => {
    assert.equal(
      writtenNames(
        "export default { title: 'a/b' };",
        'const options = { args: { a: 1 } };',
        'const holder = { a: {}, b: { box: {} } };',
        'const other = { a: { box: {} } };',
        'holder.a.box = options;',
        'holder.b.box.x = 1;',
        'other.a.box.x = 1;',
      ).includes('options'),
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

describe('csfFile readByOtherObjects', () => {
  it('leaves out a story that only its own object names when the file loads', () => {
    assert.equal(
      fileOf(
        "export default { title: 'a/b' };",
        "export var A = { args: { label: 'a', self: A?.args } };",
      ).readByOtherObjects.has('A'),
      false,
    );
  });
});

describe('csfShapes', () => {
  it('counts the .test() function of each story as test code when two stories have a .test() call of the same name', () => {
    const program = parse(
      "import preview from '../.storybook/preview';\n" +
        "const meta = preview.meta({ title: 'a/b' });\n" +
        'export const A = meta.story({});\n' +
        'export const B = meta.story({});\n' +
        "A.test('t', () => {});\n" +
        "B.test('t', () => {});\n",
      { sourceType: 'module' },
    ).program;
    const shapes = csfShapes(program);

    assert.deepEqual(
      program.body
        .slice(4)
        .map((statement) =>
          shapes.testCode.has(field(statement, 'expression', 'arguments', '1')),
        ),
      [true, true],
    );
  });

  it('counts a function expression as the test function when an argument follows it', () => {
    const program = parse(
      "import preview from '../.storybook/preview';\n" +
        "const meta = preview.meta({ title: 'a/b' });\n" +
        'export const A = meta.story({});\n' +
        "A.test('t', function () {}, {});\n",
      { sourceType: 'module' },
    ).program;
    const [, , , call] = program.body;

    assert.equal(
      csfShapes(program).testCode.has(
        field(call, 'expression', 'arguments', '1'),
      ),
      true,
    );
  });

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
