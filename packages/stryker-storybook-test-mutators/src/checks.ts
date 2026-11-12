import type { NodePath, types } from '@babel/core';

import { awaited, nameOf } from './nodes.ts';

/** Whether `path` holds a check. */
export function hasCheck(path: NodePath): boolean {
  let found = false;

  path.traverse({
    CallExpression(call) {
      if (isExpect(call.node.callee)) {
        found = true;
        call.stop();
      }
    },
  });

  return found;
}

/** A statement that is a check, such as `expect(...).<matcher>(...);`, awaited or not. */
export function isExpectStatement(
  path: NodePath,
): path is NodePath<types.ExpressionStatement> {
  return (
    path.isExpressionStatement() &&
    startsWithExpect(awaited(path.node.expression))
  );
}

/** `waitFor(...);`, awaited or not. */
export function isWaitForStatement(
  path: NodePath,
): path is NodePath<types.ExpressionStatement> {
  if (!path.isExpressionStatement()) {
    return false;
  }

  const call = awaited(path.node.expression);

  return call.type === 'CallExpression' && nameOf(call.callee) === 'waitFor';
}

function startsWithExpect(node: types.Node): boolean {
  if (node.type === 'CallExpression') {
    return isExpect(node.callee) || startsWithExpect(node.callee);
  }

  return node.type === 'MemberExpression' && startsWithExpect(node.object);
}

/** `expect`, or `expect.soft`, `expect.element` or `expect.poll`, each of which starts a check. */
function isExpect(callee: types.Node): boolean {
  return (
    nameOf(callee) === 'expect' ||
    (callee.type === 'MemberExpression' &&
      nameOf(callee.object) === 'expect' &&
      expectMethods.has(nameOf(callee.property) ?? ''))
  );
}

const expectMethods: ReadonlySet<string> = new Set(['soft', 'element', 'poll']);
