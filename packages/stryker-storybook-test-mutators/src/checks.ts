import type { NodePath, types } from '@babel/core';

import { awaited, nameOf } from './nodes.ts';

/** Whether `path` holds an `expect(...)` check with `.not` in its matcher chain. */
export function hasNegativeCheck(path: NodePath): boolean {
  return checksIn(path).some(isNegative);
}

/** `expect(...).<matcher>(...);`, awaited or not. */
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
    return nameOf(node.callee) === 'expect' || startsWithExpect(node.callee);
  }

  return node.type === 'MemberExpression' && startsWithExpect(node.object);
}

interface Check {
  /** The member names after `expect(...)`, such as `not` and `toHaveBeenCalled`. */
  readonly chain: readonly (string | undefined)[];
  /** The arguments of the matcher call at the end of the chain. */
  readonly args: readonly types.Node[];
}

/** The `expect(...)` checks in `path`. */
export function checksIn(path: NodePath): readonly Check[] {
  const checks: Check[] = [];

  path.traverse({
    CallExpression(call) {
      if (nameOf(call.node.callee) === 'expect') {
        checks.push(checkOf(call));
      }
    },
  });

  return checks;
}

function checkOf(expectCall: NodePath): Check {
  const members = matcherChain(expectCall);
  const last = members.at(-1);
  const matcherCall = last?.parentPath?.node;

  return {
    chain: members.map((member) => nameOf(member.node.property)),
    args:
      matcherCall?.type === 'CallExpression' &&
      matcherCall.callee === last?.node
        ? matcherCall.arguments
        : [],
  };
}

export function isNegative(check: Check): boolean {
  return check.chain.includes('not');
}

/** The member expressions after `expect(...)`, nearest first. */
function matcherChain(
  expectCall: NodePath,
): readonly NodePath<types.MemberExpression>[] {
  const member = expectCall.parentPath;

  return member?.isMemberExpression() && member.node.object === expectCall.node
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
