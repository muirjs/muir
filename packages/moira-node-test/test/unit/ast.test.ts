import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseSync, traverse, types, type NodePath } from '@babel/core';

import { muirTestEach } from '@muirjs/madrox-node-test';
import {
  muirMoiraNodeTestAwaited,
  muirMoiraNodeTestCalleeRoot,
  muirMoiraNodeTestImportOf,
  muirMoiraNodeTestPropertyName,
} from '../../src/ast.ts';

/** The path of the first call in `source`, parsed as a TypeScript module. */
function firstCall(source: string): NodePath<types.CallExpression> {
  const file = parseSync(source, {
    babelrc: false,
    configFile: false,
    filename: 'sample.ts',
    parserOpts: { plugins: ['typescript'] },
  });
  assert.ok(file);
  const calls: NodePath<types.CallExpression>[] = [];
  traverse(file, {
    CallExpression(path) {
      calls.push(path);
    },
  });
  const [call] = calls;
  assert.ok(call);

  return call;
}

function calleeName(source: string): string | undefined {
  const call = firstCall(source);

  return muirMoiraNodeTestCalleeRoot(call.node.callee)?.name;
}

describe('muirMoiraNodeTestImportOf', () => {
  muirTestEach([
    [
      'a default import',
      "import f from 'm';\nf();",
      'f',
      { source: 'm', imported: undefined },
    ],
    [
      'a namespace import',
      "import * as f from 'm';\nf();",
      'f',
      { source: 'm', imported: undefined },
    ],
    [
      'a named import',
      "import { f } from 'm';\nf();",
      'f',
      { source: 'm', imported: 'f' },
    ],
    [
      'a renamed import',
      "import { g as f } from 'm';\nf();",
      'f',
      { source: 'm', imported: 'g' },
    ],
    [
      'an import named by a string',
      "import { 'g' as f } from 'm';\nf();",
      'f',
      { source: 'm', imported: 'g' },
    ],
    ['a local function', 'function f() {}\nf();', 'f', undefined],
    ['a parameter', 'function g(f: () => void) {\n  f();\n}', 'f', undefined],
    ['a global', 'f();', 'f', undefined],
    ['a CommonJS require', "const f = require('m');\nf();", 'f', undefined],
  ])('finds %s', (_title, source, name, expected) => {
    assert.deepEqual(
      muirMoiraNodeTestImportOf(firstCall(source), name),
      expected,
    );
  });
});

describe('muirMoiraNodeTestPropertyName', () => {
  muirTestEach([
    ['a member', 'a.b();', 'b'],
    ['a computed member', "a['b']();", undefined],
    [
      'a private member',
      'class C {\n  #b() {}\n  c() {\n    this.#b();\n  }\n}',
      undefined,
    ],
    ['an identifier', 'b();', undefined],
  ])('names the property of %s', (_title, source, expected) => {
    assert.equal(
      muirMoiraNodeTestPropertyName(firstCall(source).node.callee),
      expected,
    );
  });
});

describe('muirMoiraNodeTestCalleeRoot', () => {
  muirTestEach([
    ['an identifier', 'f();', 'f'],
    ['a member', 'a.b();', 'a'],
    ['a member of a member', 'a.b.c();', 'a'],
    ['a member of a call', 'a().b();', undefined],
    ['a member of this', 'this.b();', undefined],
  ])('finds the root of %s', (_title, source, expected) => {
    assert.equal(calleeName(source), expected);
  });
});

describe('muirMoiraNodeTestAwaited', () => {
  it('gives the argument of an await expression', () => {
    const call = types.callExpression(types.identifier('f'), []);

    assert.equal(muirMoiraNodeTestAwaited(types.awaitExpression(call)), call);
  });

  it('gives any other expression as it is', () => {
    const call = types.callExpression(types.identifier('f'), []);

    assert.equal(muirMoiraNodeTestAwaited(call), call);
  });
});
