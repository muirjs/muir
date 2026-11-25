import type { NodePath } from '@babel/core';

import {
  muirMoiraNodeTestImportOf,
  muirMoiraNodeTestPropertyName,
  type MuirMoiraNodeTestMutator,
} from '@muirjs/moira-node-test';
import { muirProteusNodeNodeTest as nodeTest } from './bindings.ts';
import { muirProteusNodeIsNodeAssertCall } from './node-bindings.ts';

const teardowns: ReadonlySet<string | undefined> = new Set([
  'after',
  'afterEach',
]);

/**
 * StatementRemoval for `await f();`: Stryker's CallExpression mutator removes `f();` but not an awaited call, so a
 * floating-promise lint rule that adds the `await` would take the call out of mutation testing. Like that removal,
 * this one is dropped when another mutant shares the statement, as in `await f('x');`. An awaited `node:assert` call is
 * left to MuirProteusNodeAssertStatement.
 */
export const muirProteusNodeAwaitStatement: MuirMoiraNodeTestMutator = {
  name: 'MuirProteusNodeAwaitStatement',
  sample: 'await flush();\n',
  *mutate(path, t) {
    if (!path.isExpressionStatement()) {
      return;
    }

    const { expression } = path.node;

    if (
      expression.type === 'AwaitExpression' &&
      expression.argument.type === 'CallExpression' &&
      !muirProteusNodeIsNodeAssertCall(path, expression.argument) &&
      !isInsideTeardown(path)
    ) {
      yield t.emptyStatement();
    }
  },
  filter: (mutantsInScope) => mutantsInScope.length === 1,
};

function isInsideTeardown(path: NodePath): boolean {
  return (
    path.findParent(
      (parent) =>
        parent.isFunction() && teardowns.has(nodeTestCallee(parent)?.name),
    ) !== null
  );
}

/** Narrower than any parameter, as bindings.ts takes for `t.assert`: a fastify plugin's `app` parameter has `after` too. */
function isTestContext(path: NodePath, name: string): boolean {
  const callback = path.scope.getBinding(name)?.path.parentPath;

  return (
    callback?.isFunction() === true && nodeTestCallee(callback) !== undefined
  );
}

/**
 * The node:test function that `callback` is passed to: an import, by its imported name (undefined for the default
 * export), or a method of a node:test import or of a test context.
 */
function nodeTestCallee(
  callback: NodePath,
): { readonly name: string | undefined } | undefined {
  const call = callback.parentPath;

  if (call.node.type !== 'CallExpression') {
    return undefined;
  }

  const { callee } = call.node;

  if (callee.type === 'Identifier') {
    const from = muirMoiraNodeTestImportOf(call, callee.name);

    return from !== undefined && nodeTest.has(from.source)
      ? { name: from.imported }
      : undefined;
  }

  if (
    callee.type !== 'MemberExpression' ||
    callee.object.type !== 'Identifier'
  ) {
    return undefined;
  }

  const from = muirMoiraNodeTestImportOf(call, callee.object.name);
  const onNodeTest =
    from === undefined
      ? isTestContext(call, callee.object.name)
      : nodeTest.has(from.source);

  return onNodeTest
    ? { name: muirMoiraNodeTestPropertyName(callee) }
    : undefined;
}
