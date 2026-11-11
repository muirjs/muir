import type { NodePath, types } from '@babel/core';

export type Binding = NonNullable<ReturnType<NodePath['scope']['getBinding']>>;

/** The expression inside `<x>!`, `<x> as T`, `<x> satisfies T`, `<T><x>` and parentheses. */
export function withoutTypeWrappers(node: types.Node): types.Node {
  return node.type === 'TSNonNullExpression' ||
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'ParenthesizedExpression'
    ? withoutTypeWrappers(node.expression)
    : node;
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
