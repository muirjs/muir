import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parse } from '@babel/parser';

import {
  csfFile,
  csfShapes,
  mayImportItself,
  topLevelBindings,
} from '../src/csf.ts';
import { field, list } from '../src/node-field.ts';
import { sitesOf } from '../src/sites.ts';
import { bodyOf, programOf, programsOf } from './support/parse-module.ts';

function fileOf(...lines: readonly string[]) {
  const body = bodyOf(...lines);

  return csfFile(body, topLevelBindings(body));
}

function testFunctionOf(statement: unknown): unknown {
  const [, testFunction] = list(field(statement, 'expression', 'arguments'));

  return testFunction;
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

  ["'/a'", '1', 'true', 'null', '1n', '`/a`'].forEach((literal) => {
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

  it('leaves out a name assigned to a member when the file writes only below another member', () => {
    assert.equal(
      writtenNames(
        "export default { title: 'a/b' };",
        'const options = { args: { a: 1 } };',
        'const holder = { a: {}, b: { box: {} } };',
        'holder.a.box = options;',
        'holder.b.box.x = 1;',
      ).includes('options'),
      false,
    );
  });

  it('leaves out a name assigned to a member when the file writes only below the same member of another object', () => {
    assert.equal(
      writtenNames(
        "export default { title: 'a/b' };",
        'const options = { args: { a: 1 } };',
        'const holder = { a: {} };',
        'const other = { a: { box: {} } };',
        'holder.a.box = options;',
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

describe('mayImportItself', () => {
  it('holds for an import() whose specifier is not a string literal, in either parsed shape', () => {
    assert.deepEqual(
      programsOf('const stories = await import(name);').map(({ body }) =>
        mayImportItself(body, 'Button.stories.ts'),
      ),
      [true, true],
    );
  });

  it('does not hold for an import() or a require() of a string literal that names another file, in either parsed shape', () => {
    assert.deepEqual(
      programsOf(
        "const stories = await import('./Other.stories');",
        "const utility = require('./utility');",
      ).map(({ body }) => mayImportItself(body, 'Button.stories.ts')),
      [false, false],
    );
  });

  it('holds for a root-absolute specifier, which Vite resolves from a root the file does not name, in either parsed shape', () => {
    assert.deepEqual(
      programsOf("import * as self from '/src/Button.stories';").map(
        ({ body }) => mayImportItself(body, 'Button.stories.ts'),
      ),
      [true, true],
    );
  });

  it('does not hold for a root-absolute import of a file with another name, such as a stylesheet or an image', () => {
    assert.deepEqual(
      programsOf(
        "import '/src/styles.css';",
        "import logo from '/assets/logo.svg';",
      ).map(({ body }) => mayImportItself(body, 'Button.stories.ts')),
      [false, false],
    );
  });

  it('holds for an import through a path alias whose last segment names the file, in either parsed shape', () => {
    assert.deepEqual(
      programsOf("import * as self from '@/components/Button.stories';").map(
        ({ body }) => mayImportItself(body, 'Button.stories.ts'),
      ),
      [true, true],
    );
  });

  it('holds for an import through a drive path whose last segment names the file, in either parsed shape', () => {
    assert.deepEqual(
      programsOf("import * as self from 'D:/app/src/Button.stories.js';").map(
        ({ body }) => mayImportItself(body, 'Button.stories.ts'),
      ),
      [true, true],
    );
  });

  it('holds for a backslash path whose last segment names the file, on every platform, in either parsed shape', () => {
    assert.deepEqual(
      programsOf(
        String.raw`import * as self from 'C:\\app\\src\\Button.stories';`,
      ).map(({ body }) => mayImportItself(body, 'Button.stories.ts')),
      [true, true],
    );
  });

  it('holds for a relative string that names the file with another script extension, such as a vi.mock path, as an import of it does, in either parsed shape', () => {
    assert.deepEqual(
      programsOf("vi.mock('./Button.stories.tsx');").map(({ body }) =>
        mayImportItself(body, 'Button.stories.ts'),
      ),
      [true, true],
    );
  });

  it('does not hold for a non-relative path the file holds in a parameter but does not load, in either parsed shape', () => {
    assert.deepEqual(
      programsOf(
        "export default { parameters: { importPath: 'core/src/Button.stories.tsx' } };",
      ).map(({ body }) => mayImportItself(body, 'Button.stories.ts')),
      [false, false],
    );
  });

  it('does not hold for a title whose last segment spells the file name, in either parsed shape', () => {
    assert.deepEqual(
      programsOf("export default { title: 'Example/Button.stories' };").map(
        ({ body }) => mayImportItself(body, 'Button.stories.ts'),
      ),
      [false, false],
    );
  });

  it('does not hold for a title whose last segment is the component the file is named after, in either parsed shape', () => {
    assert.deepEqual(
      programsOf("export default { title: 'Components/Button' };").map(
        ({ body }) => mayImportItself(body, 'Button.tsx'),
      ),
      [false, false],
    );
  });

  it('does not hold for a package spelled like the file, which is a package entry, in either parsed shape', () => {
    assert.deepEqual(
      programsOf("import * as other from 'Button.stories';").map(({ body }) =>
        mayImportItself(body, 'Button.stories.ts'),
      ),
      [false, false],
    );
  });

  it('does not hold for a relative import of a file of the same name in another folder, in either parsed shape', () => {
    assert.deepEqual(
      programsOf("import * as other from '../legacy/Button.stories';").map(
        ({ body }) => mayImportItself(body, 'src/Button.stories.ts'),
      ),
      [false, false],
    );
  });

  it('does not hold for a story file that imports only other modules and declares its exports', () => {
    assert.deepEqual(
      programsOf(
        "import { fn } from 'storybook/test';",
        "export default { title: 'a/b', args: { onClick: fn() } };",
        "export const Primary = { args: { label: 'a' }, play: async () => {} };",
        'export { Primary as Main };',
      ).map(({ body }) => mayImportItself(body, 'Button.stories.ts')),
      [false, false],
    );
  });

  it('holds for an export from a path alias whose last segment names the file, in either parsed shape', () => {
    assert.deepEqual(
      [
        "export * from '@/components/Button.stories';",
        "export { Primary } from '@/components/Button.stories';",
      ].map((source) =>
        programsOf(source).map(({ body }) =>
          mayImportItself(body, 'Button.stories.ts'),
        ),
      ),
      [
        [true, true],
        [true, true],
      ],
    );
  });

  it('does not hold for another import.meta call, a glob on another object, or a glob on new.target, in either parsed shape', () => {
    assert.deepEqual(
      [
        "const resolved = import.meta.resolve('some-package');",
        "const files = fs.glob('*.stories.ts');",
        'function make() { return new.target.glob(); }',
      ].map((source) =>
        programsOf(source).map(({ body }) =>
          mayImportItself(body, 'Button.stories.ts'),
        ),
      ),
      [
        [false, false],
        [false, false],
        [false, false],
      ],
    );
  });

  it('holds for an import.meta.glob call, whose pattern may match the file, in either parsed shape', () => {
    assert.deepEqual(
      programsOf(
        "const stories = import.meta.glob('./*.stories.ts', { eager: true });",
      ).map(({ body }) => mayImportItself(body, 'Button.stories.ts')),
      [true, true],
    );
  });

  it('holds for a specifier that names the file in another case, which a case-insensitive file system loads as the file, in either parsed shape', () => {
    assert.deepEqual(
      programsOf("import * as self from './button.stories';").map(({ body }) =>
        mayImportItself(body, 'Button.stories.ts'),
      ),
      [true, true],
    );
  });
});

describe('csfFile readByOtherObjects', () => {
  it('keeps the same-as-below proof of a story that only its own object names when the file loads', () => {
    assert.deepEqual(
      sitesOf(
        bodyOf(
          "export default { title: 'a/b', args: { label: 'a' } };",
          "export var A = { args: { label: 'a', self: A?.args }, play: async () => {} };",
        ),
        'args',
        'Button.stories.ts',
      ).map(({ proofs }) => proofs.map(({ reason }) => reason)),
      [['same-as-below'], []],
    );
  });
});

describe('csfShapes', () => {
  it('counts the .test() function of each story as test code when two stories have a .test() call of the same name', () => {
    const program = programOf(
      "import preview from '../.storybook/preview';",
      "const meta = preview.meta({ title: 'a/b' });",
      'export const A = meta.story({});',
      'export const B = meta.story({});',
      "A.test('t', () => {});",
      "B.test('t', () => {});",
    );
    const [testOfA, testOfB] = program.body.slice(-2);
    const shapes = csfShapes(program);

    assert.deepEqual(
      [testOfA, testOfB].map((statement) =>
        shapes.testCode.has(testFunctionOf(statement)),
      ),
      [true, true],
    );
  });

  it('counts a function expression as the test function when an argument follows it', () => {
    const program = programOf(
      "import preview from '../.storybook/preview';",
      "const meta = preview.meta({ title: 'a/b' });",
      'export const A = meta.story({});',
      "A.test('t', function () {}, {});",
    );
    const [testOfA] = program.body.slice(-1);

    assert.equal(
      csfShapes(program).testCode.has(testFunctionOf(testOfA)),
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
    const [withOptions, plain] = program.body.slice(-2);
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
