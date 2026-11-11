import {
  bindingOf,
  callTypes,
  fieldOf,
  findProperty,
  isMember,
  memberNameOf,
} from '@layzee/stryker-mutator-install';

// Stryker's instrumenter visits nothing inside `as`, but it visits inside these wrappers.
const typeWrappers: readonly unknown[] = [
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
];

/** `<x> satisfies <T>`, `<x>!` or `<T><x>`. */
function isTypeWrapper(node: unknown): boolean {
  return typeWrappers.includes(fieldOf(node, 'type'));
}

/** The expression inside any type wrapper around `node`. */
export function unwrapped(node: unknown): unknown {
  return isTypeWrapper(node) ? unwrapped(fieldOf(node, 'expression')) : node;
}

/** The path of the outermost type wrapper around `path`, or `path` itself. */
export function outermost(path: unknown): unknown {
  return isTypeWrapper(fieldOf(path, 'parent'))
    ? outermost(fieldOf(path, 'parentPath'))
    : path;
}

/** `<x>(...)` or `<x>?.(...)`. */
export function isCall(node: unknown): boolean {
  return callTypes.includes(fieldOf(node, 'type'));
}

/** The row of `table` under `key`, or undefined when `key` is no string or no own key of it. */
export function rowOf<T>(
  table: Readonly<Record<string, T>>,
  key: unknown,
): T | undefined {
  return typeof key === 'string' && Object.hasOwn(table, key)
    ? table[key]
    : undefined;
}

export function hasProperty(object: unknown, key: string): boolean {
  return findProperty(object, key) !== undefined;
}

/** `<name>`, `<x>.<name>` or `<x>?.<name>`. */
export function isNamedReceiver(node: unknown, name: string): boolean {
  return fieldOf(node, 'name') === name || memberNameOf(node) === name;
}

/**
 * An APIRequestContext, which sends requests: `<x>.request`, `<x>?.request`, or a bare `request` that a parameter
 * binds, a fixture or a helper's argument.
 */
export function isRequestContext(path: unknown, node: unknown): boolean {
  return (
    memberNameOf(node) === 'request' ||
    (fieldOf(node, 'name') === 'request' &&
      fieldOf(bindingOf(path, 'request'), 'kind') === 'param')
  );
}

/**
 * An APIRequest, which `newContext` is called on: `request`, `<x>.request` or `<x>?.request`. A bare `request` counts
 * however it is bound, as `import { request } from '@playwright/test'` gives one.
 */
export function isRequestFactory(node: unknown): boolean {
  return isNamedReceiver(node, 'request');
}

/** `test`, or a member chain on it such as `test.describe.serial`. */
export function isTestCallee(callee: unknown): boolean {
  if (isMember(callee)) {
    return isTestCallee(fieldOf(callee, 'object'));
  }

  return fieldOf(callee, 'name') === 'test';
}

/** A node whose type names a function or a method, such as `ArrowFunctionExpression` or `ObjectMethod`. */
export function isFunctionNode(node: unknown): boolean {
  const type = fieldOf(node, 'type');

  return typeof type === 'string' && /Function|Method/.test(type);
}

/** The paths around `path`, nearest first. */
export function* ancestors(path: unknown): Generator<unknown, void, void> {
  for (
    let current = fieldOf(path, 'parentPath');
    current != null;
    current = fieldOf(current, 'parentPath')
  ) {
    yield current;
  }
}
