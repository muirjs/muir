import type { NodePath, types } from '@babel/core';

import { type Binding, bindingOf } from './nodes.ts';

/** A binding whose every reference is a method call's receiver or a side of a choice given to such a local. */
export function isOnlyCalledOn(
  binding: Binding | undefined,
  seen: ReadonlySet<Binding> = new Set(),
): boolean {
  return (
    binding !== undefined &&
    binding.referencePaths.every(
      (reference) =>
        isMethodCallReceiver(reference) || isChoiceSide(reference, seen),
    )
  );
}

/** `<path>.<name>` or `<path>?.<name>`. */
export function isMemberObject(path: NodePath): boolean {
  const { parentPath } = path;

  return (
    path.key === 'object' &&
    parentPath !== null &&
    (parentPath.isMemberExpression() ||
      parentPath.isOptionalMemberExpression()) &&
    !parentPath.node.computed
  );
}

/** `<path>.<method>(...)`, optional or not. */
export function isMethodCallReceiver(path: NodePath): boolean {
  return isMemberObject(path) && path.parentPath?.key === 'callee';
}

/** A side of `<test> ? <a> : <b>` that is the one value of a local only called on. */
export function isChoiceSide(
  path: NodePath,
  seen: ReadonlySet<Binding> = new Set(),
): boolean {
  const choice = path.parentPath;

  if (!choice?.isConditionalExpression() || path.key === 'test') {
    return false;
  }

  const local = localGiven(choice);
  const value =
    local?.path.isVariableDeclarator() === true
      ? boundValue(local.path, local)
      : undefined;

  return (
    local !== undefined &&
    value?.node === choice.node &&
    (seen.has(local) || isOnlyCalledOn(local, new Set([...seen, local])))
  );
}

/** The local that `value` is given to, by a declaration's `init` or the right side of an assignment. */
function localGiven(value: NodePath): Binding | undefined {
  const { parentPath } = value;

  if (parentPath?.isVariableDeclarator() && value.key === 'init') {
    return bindingOf(parentPath.node.id, parentPath.scope);
  }

  return parentPath?.isAssignmentExpression() && value.key === 'right'
    ? bindingOf(parentPath.node.left, parentPath.scope)
    : undefined;
}

/** A value and where it is given, whose scope its names are read in. */
export interface GivenValue {
  readonly node: types.Node;
  readonly at: NodePath;
}

/** The one value a local is ever given, by its declaration's `init` or a later assignment; none when something else, such as `++` or a `for...of` head, also changes it. */
export function boundValue(
  declaration: NodePath<types.VariableDeclarator>,
  binding: Binding,
): GivenValue | undefined {
  const assigned = binding.constantViolations.flatMap(
    (violation): readonly GivenValue[] =>
      violation.node.type === 'AssignmentExpression'
        ? [{ node: violation.node.right, at: violation }]
        : [],
  );

  if (assigned.length < binding.constantViolations.length) {
    return undefined;
  }

  const { init } = declaration.node;
  const values: readonly GivenValue[] =
    init === null || init === undefined
      ? assigned
      : [{ node: init, at: declaration }, ...assigned];

  return values.length === 1 ? values[0] : undefined;
}
