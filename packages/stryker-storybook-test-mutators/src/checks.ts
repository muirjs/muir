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
  if (callee.type !== 'MemberExpression') {
    return nameOf(callee) === 'expect';
  }

  const method = memberName(callee);

  return (
    nameOf(callee.object) === 'expect' &&
    method !== undefined &&
    expectMethods.has(method)
  );
}

/** The name a member reads: its identifier, or its string-literal key when computed. */
function memberName(member: types.MemberExpression): string | undefined {
  if (member.computed) {
    return member.property.type === 'StringLiteral'
      ? member.property.value
      : undefined;
  }

  return nameOf(member.property);
}

const expectMethods: ReadonlySet<string> = new Set(['soft', 'element', 'poll']);
