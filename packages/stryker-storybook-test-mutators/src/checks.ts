import type { NodePath, types } from '@babel/core';

import { awaited, nameOf } from './nodes.ts';

/** Whether `path` holds a check: a matcher chain on a call of what `isExpect` names. */
export function hasCheck(path: NodePath): boolean {
  return checksIn(path).length > 0;
}

/** Whether `path` holds a check with `.not` in its matcher chain. */
export function hasNegativeCheck(path: NodePath): boolean {
  return checksIn(path).some(isNegative);
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

interface Check {
  /** The member names after `expect(...)`, such as `not` and `toHaveBeenCalled`. */
  readonly chain: readonly (string | undefined)[];
  /** The arguments of the matcher call at the end of the chain. */
  readonly args: readonly types.Node[];
}

/** The checks in `path`. */
function checksIn(path: NodePath): readonly Check[] {
  const checks: Check[] = [];

  path.traverse({
    CallExpression(call) {
      if (isExpect(call.node.callee)) {
        checks.push(checkOf(call));
      }
    },
  });

  return checks;
}

function checkOf(expectCall: NodePath): Check {
  const members = matcherChain(expectCall);
  const last = members.at(-1);
  const matcherCall = last?.parent;

  return {
    chain: members.map((member) => nameOf(member.node.property)),
    args:
      matcherCall?.type === 'CallExpression' &&
      matcherCall.callee === last?.node
        ? matcherCall.arguments
        : [],
  };
}

function isNegative(check: Check): boolean {
  return check.chain.includes('not');
}

/** The member expressions after `expect(...)`, nearest first. */
function matcherChain(
  expectCall: NodePath,
): readonly NodePath<types.MemberExpression>[] {
  const member = expectCall.parentPath;

  return member.isMemberExpression() && member.node.object === expectCall.node
    ? [member, ...matcherChain(member)]
    : [];
}

/** Whether `path` holds an `expect(...).toHaveBeenCalledTimes(0)` check. */
export function hasZeroCallsCheck(path: NodePath): boolean {
  return checksIn(path).some(
    ({ chain, args: [count] }) =>
      chain.at(-1) === 'toHaveBeenCalledTimes' &&
      count?.type === 'NumericLiteral' &&
      count.value === 0,
  );
}
