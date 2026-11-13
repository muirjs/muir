import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { field } from '../src/node-field.ts';
import { nodesIn } from '../src/node-tree.ts';
import { fileScope } from '../src/scope.ts';
import { programsOf } from './support/parse-module.ts';

interface ScopeCase {
  readonly title: string;
  readonly lines: readonly string[];
  readonly name: string;
  /** The textual occurrence of `name`, from 0, that is read or written. */
  readonly reference: number;
  /** The textual occurrence of `name` that declares the binding it resolves to, or `undefined` for none. */
  readonly declaredBy: number | undefined;
}

/** The start of each textual occurrence of `name` in `source`. */
function occurrences(source: string, name: string): readonly number[] {
  return [...source.matchAll(new RegExp(`\\b${name}\\b`, 'g'))].map(
    ({ index }) => index,
  );
}

/** The identifier that starts at `start`; the value of a shorthand property, which shares its key's start, before the key. */
function identifierAt(program: object, start: number | undefined): unknown {
  return nodesIn(program)
    .filter(
      (node) =>
        field(node, 'type') === 'Identifier' && field(node, 'start') === start,
    )
    .at(-1);
}

/** For each parse of the case, the occurrence that declares what its reference resolves to. */
function declarationsOf({
  lines,
  name,
  reference,
}: ScopeCase): readonly (number | undefined)[] {
  const starts = occurrences(lines.join('\n'), name);

  return programsOf(...lines).map((program) => {
    const binding = fileScope(program).bindingOf(
      identifierAt(program, starts[reference]),
    );

    return binding === undefined
      ? undefined
      : starts.indexOf(Number(field(binding.identifier, 'start')));
  });
}

const scopeCases: readonly ScopeCase[] = [
  {
    title:
      "a var in a nested block of a play redeclares the play context's userEvent, so a later read resolves to the parameter",
    lines: [
      'export const Story = {',
      '  play: async ({ userEvent }) => {',
      '    if (open) {',
      '      var userEvent = other;',
      '    }',
      '    await userEvent.click(button);',
      '  },',
      '};',
    ],
    name: 'userEvent',
    reference: 2,
    declaredBy: 0,
  },
  {
    title: 'a const in a block shadows an outer one inside the block',
    lines: [
      'const user = first;',
      '{',
      '  const user = second;',
      '  use(user);',
      '}',
    ],
    name: 'user',
    reference: 2,
    declaredBy: 1,
  },
  {
    title: 'a read above a function declaration resolves to it',
    lines: ['await itemCount(1);', 'function itemCount(count) {}'],
    name: 'itemCount',
    reference: 0,
    declaredBy: 1,
  },
  {
    title: 'a read in a play resolves to an import under another name',
    lines: [
      "import { userEvent as ue } from 'storybook/test';",
      'export const Story = {',
      '  play: async () => {',
      '    await ue.click(button);',
      '  },',
      '};',
    ],
    name: 'ue',
    reference: 1,
    declaredBy: 0,
  },
  {
    title:
      'a var in a nested block of a play shadows a storybook/test import of userEvent throughout the play',
    lines: [
      "import { userEvent } from 'storybook/test';",
      'export const Story = {',
      '  play: async () => {',
      '    await userEvent.click(button);',
      '    if (open) {',
      '      var userEvent = other;',
      '    }',
      '  },',
      '};',
    ],
    name: 'userEvent',
    reference: 1,
    declaredBy: 2,
  },
  {
    title:
      'a var in a for...of head shadows a storybook/test import of userEvent after the loop',
    lines: [
      "import { userEvent } from 'storybook/test';",
      'export const Story = {',
      '  play: async () => {',
      '    for (var userEvent of drivers) {}',
      '    await userEvent.click(button);',
      '  },',
      '};',
    ],
    name: 'userEvent',
    reference: 2,
    declaredBy: 1,
  },
  {
    title: 'a const in one case of a switch is bound in a later case of it',
    lines: [
      'const user = first;',
      'switch (step) {',
      '  case 0:',
      '    const user = second;',
      '  case 1:',
      '    use(user);',
      '}',
      'use(user);',
    ],
    name: 'user',
    reference: 2,
    declaredBy: 1,
  },
  {
    title:
      "a const in a for...of head of a play leaves the play context's userEvent bound after the loop",
    lines: [
      'export const Story = {',
      '  play: async ({ userEvent }) => {',
      '    for (const userEvent of drivers) {}',
      '    await userEvent.click(button);',
      '  },',
      '};',
    ],
    name: 'userEvent',
    reference: 2,
    declaredBy: 0,
  },
  {
    title: 'a catch parameter is bound in its clause',
    lines: [
      'const user = first;',
      'try {',
      '  run();',
      '} catch (user) {',
      '  use(user);',
      '}',
    ],
    name: 'user',
    reference: 2,
    declaredBy: 1,
  },
  {
    title: 'a read above a class declaration resolves to it',
    lines: ['use(Driver);', 'class Driver {}'],
    name: 'Driver',
    reference: 0,
    declaredBy: 1,
  },
  {
    title: "a named function expression's own name is bound inside it",
    lines: [
      'const retry = first;',
      'const run = function retry() {',
      '  return retry();',
      '};',
    ],
    name: 'retry',
    reference: 2,
    declaredBy: 1,
  },
  {
    title:
      "a parameter named as its function expression shadows the function's name in the body",
    lines: ['const run = function retry(retry) {', '  return retry;', '};'],
    name: 'retry',
    reference: 2,
    declaredBy: 1,
  },
  {
    title: 'a label names no binding',
    lines: [
      'const done = first;',
      'done: for (const item of items) {',
      '  break done;',
      '}',
    ],
    name: 'done',
    reference: 2,
    declaredBy: undefined,
  },
  {
    title: 'a name in a type reads no value binding',
    lines: ['const Driver = first;', 'use(value as Driver);'],
    name: 'Driver',
    reference: 1,
    declaredBy: undefined,
  },
  {
    title: 'a key in an interface reads no value binding',
    lines: ['const user = first;', 'interface Props {', '  user: string;', '}'],
    name: 'user',
    reference: 1,
    declaredBy: undefined,
  },
  {
    title: 'the name an export specifier exports under reads no binding',
    lines: [
      'const user = first;',
      'const other = second;',
      'export { other as user };',
    ],
    name: 'user',
    reference: 1,
    declaredBy: undefined,
  },
  {
    title: 'import.meta reads no binding named meta',
    lines: ['const meta = first;', 'use(import.meta.url);'],
    name: 'meta',
    reference: 1,
    declaredBy: undefined,
  },
  {
    title: 'the key of a class property reads no binding',
    lines: ['const user = first;', 'class Page {', '  user = second;', '}'],
    name: 'user',
    reference: 1,
    declaredBy: undefined,
  },
  {
    title: "a method's computed key reads the binding it names",
    lines: ['const user = first;', 'const page = {', '  [user]() {},', '};'],
    name: 'user',
    reference: 1,
    declaredBy: 0,
  },
  {
    title:
      "a parameter of a local arrow shadows the play context's userEvent inside the arrow",
    lines: [
      'export const Story = {',
      '  play: async ({ userEvent }) => {',
      '    const fill = async ({ userEvent }) => {',
      '      await userEvent.type(input, "a");',
      '    };',
      '  },',
      '};',
    ],
    name: 'userEvent',
    reference: 2,
    declaredBy: 1,
  },
  {
    title: 'a read above a var in its function resolves to the var',
    lines: [
      'const user = first;',
      'function run() {',
      '  use(user);',
      '  var user = second;',
      '}',
    ],
    name: 'user',
    reference: 1,
    declaredBy: 2,
  },
  {
    title: "a class expression's own name declares its own binding",
    lines: ['const Page = first;', 'const other = class Page {};'],
    name: 'Page',
    reference: 1,
    declaredBy: 1,
  },
  {
    title: 'a let in a class static block shadows an outer const inside it',
    lines: [
      'const user = first;',
      'class Page {',
      '  static {',
      '    let user = second;',
      '    use(user);',
      '  }',
      '}',
    ],
    name: 'user',
    reference: 2,
    declaredBy: 1,
  },
  {
    title:
      'a var in a class static block is bound in the block, not outside it',
    lines: [
      'class Page {',
      '  static {',
      '    var user = second;',
      '  }',
      '}',
      'use(user);',
    ],
    name: 'user',
    reference: 1,
    declaredBy: undefined,
  },
  {
    title: "a named class expression's own name is bound inside the class",
    lines: [
      'const Page = first;',
      'const other = class Page {',
      '  open() {',
      '    return Page;',
      '  }',
      '};',
    ],
    name: 'Page',
    reference: 2,
    declaredBy: 1,
  },
  {
    title:
      "a parameter's default reads the outer binding, not a const in the function's body",
    lines: [
      'const user = first;',
      'function run(driver = user) {',
      '  const user = second;',
      '}',
    ],
    name: 'user',
    reference: 1,
    declaredBy: 0,
  },
  {
    title: 'a let in a for head is bound in the loop body',
    lines: [
      'const user = first;',
      'for (let user = second, i = 0; i < 1; i += 1) {',
      '  use(user);',
      '}',
    ],
    name: 'user',
    reference: 2,
    declaredBy: 1,
  },
];

interface WriteCase {
  readonly title: string;
  readonly lines: readonly string[];
  readonly name: string;
  /** The textual occurrence of `name`, from 0, whose binding's writes are counted. */
  readonly reference: number;
  /** The type of each node that writes the binding, in source order. */
  readonly writes: readonly string[];
}

/** For each parse of the case, the types of the nodes that write the binding its reference resolves to. */
function writesOf({
  lines,
  name,
  reference,
}: WriteCase): readonly (readonly unknown[])[] {
  const starts = occurrences(lines.join('\n'), name);

  return programsOf(...lines).map((program) =>
    (
      fileScope(program).bindingOf(identifierAt(program, starts[reference]))
        ?.writes ?? []
    ).map((write) => field(write, 'type')),
  );
}

const writeCases: readonly WriteCase[] = [
  {
    title: 'a var that redeclares a parameter writes it',
    lines: [
      'export const Story = {',
      '  play: async ({ userEvent }) => {',
      '    if (open) {',
      '      var userEvent = other;',
      '    }',
      '  },',
      '};',
    ],
    name: 'userEvent',
    reference: 0,
    writes: ['VariableDeclarator'],
  },
  {
    title: 'an assignment writes the name it assigns',
    lines: ['let user = first;', 'user = second;'],
    name: 'user',
    reference: 0,
    writes: ['AssignmentExpression'],
  },
  {
    title: 'an assignment writes a name inside an as expression',
    lines: ['let user = first;', '(user as Driver) = second;'],
    name: 'user',
    reference: 0,
    writes: ['AssignmentExpression'],
  },
  {
    title: 'an assignment writes a name under a non-null assertion',
    lines: ['let user = first;', 'user! = second;'],
    name: 'user',
    reference: 0,
    writes: ['AssignmentExpression'],
  },
  {
    title: 'an assignment writes a name inside a satisfies expression',
    lines: ['let user = first;', '(user satisfies Driver) = second;'],
    name: 'user',
    reference: 0,
    writes: ['AssignmentExpression'],
  },
  {
    title: 'an update writes a name under a non-null assertion',
    lines: ['let count = 0;', 'count!++;'],
    name: 'count',
    reference: 0,
    writes: ['UpdateExpression'],
  },
  {
    title:
      'a for...of head that declares nothing writes a name inside an as expression',
    lines: ['let user = first;', 'for ((user as Driver) of drivers) {}'],
    name: 'user',
    reference: 0,
    writes: ['ForOfStatement'],
  },
  {
    title: 'a for...in head that declares nothing writes the name',
    lines: ['let key = first;', 'for (key in record) {}'],
    name: 'key',
    reference: 0,
    writes: ['ForInStatement'],
  },
  {
    title: 'a destructuring assignment writes a name in its pattern',
    lines: ['let user = first;', '({ user } = drivers);'],
    name: 'user',
    reference: 0,
    writes: ['AssignmentExpression'],
  },
  {
    title:
      "a parameter named as its function expression is no write of the function's name",
    lines: ['const run = function retry(retry) {', '  return retry;', '};'],
    name: 'retry',
    reference: 0,
    writes: [],
  },
  {
    title:
      "an assignment in a play parameter's default writes the play context's userEvent",
    lines: [
      'export const Story = {',
      '  play: async ({ userEvent }, driver = (userEvent = other)) => {},',
      '};',
    ],
    name: 'userEvent',
    reference: 0,
    writes: ['AssignmentExpression'],
  },
];

interface KindCase {
  readonly title: string;
  readonly lines: readonly string[];
  readonly name: string;
  /** The textual occurrence of `name`, from 0, whose binding is read. */
  readonly reference: number;
  readonly kind: string;
  /** The type of the node that declares the binding. */
  readonly declaration: string;
}

const kindCases: readonly KindCase[] = [
  {
    title: 'a const binds a const, declared by its declarator',
    lines: ['const user = first;', 'use(user);'],
    name: 'user',
    reference: 1,
    kind: 'const',
    declaration: 'VariableDeclarator',
  },
  {
    title:
      'a destructured parameter binds a param, declared by the parameter as the function lists it',
    lines: ['const play = async ({ userEvent = other }) => use(userEvent);'],
    name: 'userEvent',
    reference: 1,
    kind: 'param',
    declaration: 'ObjectPattern',
  },
  {
    title: 'an import binds an import, declared by its specifier',
    lines: [
      "import userEvent from '@testing-library/user-event';",
      'use(userEvent);',
    ],
    name: 'userEvent',
    reference: 1,
    kind: 'import',
    declaration: 'ImportDefaultSpecifier',
  },
];

describe('fileScope binding kind and declaration', () => {
  kindCases.forEach(({ title, lines, name, reference, kind, declaration }) => {
    it(title, () => {
      const start = occurrences(lines.join('\n'), name)[reference];

      assert.deepEqual(
        programsOf(...lines).map((program) => {
          const binding = fileScope(program).bindingOf(
            identifierAt(program, start),
          );

          return [binding?.kind, field(binding?.declaration, 'type')];
        }),
        [
          [kind, declaration],
          [kind, declaration],
        ],
      );
    });
  });
});

describe('fileScope referencesIn', () => {
  it('gives the identifiers a node reads or writes, not its keys or member names', () => {
    assert.deepEqual(
      programsOf('use(page.user, { key: value });', 'count = 1;').map(
        (program) => {
          const scope = fileScope(program);

          return program.body.map((statement) =>
            scope
              .referencesIn(statement)
              .map((identifier) => field(identifier, 'name')),
          );
        },
      ),
      [
        [['use', 'page', 'value'], ['count']],
        [['use', 'page', 'value'], ['count']],
      ],
    );
  });
});

describe('fileScope writes', () => {
  writeCases.forEach((writeCase) => {
    it(writeCase.title, () => {
      assert.deepEqual(writesOf(writeCase), [
        writeCase.writes,
        writeCase.writes,
      ]);
    });
  });
});

describe('fileScope bindingOf', () => {
  scopeCases.forEach((scopeCase) => {
    it(scopeCase.title, () => {
      assert.deepEqual(declarationsOf(scopeCase), [
        scopeCase.declaredBy,
        scopeCase.declaredBy,
      ]);
    });
  });
});
