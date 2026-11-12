import type { NodePath, types } from '@babel/core';

export type Binding = NonNullable<ReturnType<NodePath['scope']['getBinding']>>;

type TypeWrapper =
  | types.TSNonNullExpression
  | types.TSAsExpression
  | types.TSSatisfiesExpression
  | types.TSTypeAssertion
  | types.ParenthesizedExpression;

/** `<x>!`, `<x> as T`, `<x> satisfies T`, `<T><x>` or parentheses, which leave the value of `<x>` as it is. */
function isTypeWrapper(node: types.Node): node is TypeWrapper {
  return (
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'ParenthesizedExpression'
  );
}

/** The expression inside any type wrappers. */
export function withoutTypeWrappers(node: types.Node): types.Node {
  return isTypeWrapper(node) ? withoutTypeWrappers(node.expression) : node;
}

/** Inside a type, such as `typeof <x>`, which does not run. */
export function isInType(path: NodePath): boolean {
  return path.findParent((parent) => parent.isTSType()) !== null;
}

/** The outermost type wrapper around `path`, or `path` itself. */
export function outsideTypeWrappers(path: NodePath): NodePath {
  const { parentPath } = path;

  return parentPath !== null &&
    isTypeWrapper(parentPath.node) &&
    path.key === 'expression'
    ? outsideTypeWrappers(parentPath)
    : path;
}

/** The expression inside `await <x>` and any type wrappers around either. */
export function awaited(node: types.Node): types.Node {
  const expression = withoutTypeWrappers(node);

  return withoutTypeWrappers(
    expression.type === 'AwaitExpression' ? expression.argument : expression,
  );
}

/** The name of an object key, quoted or not. */
export function keyName(key: types.Node): string | undefined {
  return key.type === 'StringLiteral' ? key.value : nameOf(key);
}

export function nameOf(node: types.Node): string | undefined {
  return node.type === 'Identifier' ? node.name : undefined;
}

/** The property name of `<x>.<name>` or `<x>?.<name>`. */
export function memberName(node: types.Node): string | undefined {
  return node.type === 'MemberExpression' ||
    node.type === 'OptionalMemberExpression'
    ? nameOf(node.property)
    : undefined;
}

/** The binding that the identifier `node` refers to in `scope`. */
export function bindingOf(
  node: types.Node,
  scope: NodePath['scope'],
): Binding | undefined {
  const name = nameOf(node);

  return name === undefined ? undefined : scope.getBinding(name);
}
