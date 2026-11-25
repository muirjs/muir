import {
  muirMoiraMutatorsBindingOf,
  muirMoiraMutatorsCallTypes,
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsFindProperty,
  muirMoiraMutatorsIsMember,
  muirMoiraMutatorsMemberNameOf,
} from '@muirjs/moira-mutators';

// Stryker's instrumenter visits nothing inside `as`, but it visits inside these wrappers.
const typeWrappers: readonly unknown[] = [
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
];

/** `<x> satisfies <T>`, `<x>!` or `<T><x>`. */
function isTypeWrapper(node: unknown): boolean {
  return typeWrappers.includes(muirMoiraMutatorsFieldOf(node, 'type'));
}

/** The expression inside any type wrapper around `node`. */
export function muirProteusPlaywrightUnwrapped(node: unknown): unknown {
  return isTypeWrapper(node)
    ? muirProteusPlaywrightUnwrapped(
        muirMoiraMutatorsFieldOf(node, 'expression'),
      )
    : node;
}

/** The path of the outermost type wrapper around `path`, or `path` itself. */
export function muirProteusPlaywrightOutermost(path: unknown): unknown {
  return isTypeWrapper(muirMoiraMutatorsFieldOf(path, 'parent'))
    ? muirProteusPlaywrightOutermost(
        muirMoiraMutatorsFieldOf(path, 'parentPath'),
      )
    : path;
}

/** `<x>(...)` or `<x>?.(...)`. */
export function muirProteusPlaywrightIsCall(node: unknown): boolean {
  return muirMoiraMutatorsCallTypes.includes(
    muirMoiraMutatorsFieldOf(node, 'type'),
  );
}

/** The row of `table` under `key`, or undefined when `key` is no string or no own key of it. */
export function muirProteusPlaywrightRowOf<T>(
  table: Readonly<Record<string, T>>,
  key: unknown,
): T | undefined {
  return typeof key === 'string' && Object.hasOwn(table, key)
    ? table[key]
    : undefined;
}

export function muirProteusPlaywrightHasProperty(
  object: unknown,
  key: string,
): boolean {
  return muirMoiraMutatorsFindProperty(object, key) !== undefined;
}

/** `<name>`, `<x>.<name>` or `<x>?.<name>`. */
export function muirProteusPlaywrightIsNamedReceiver(
  node: unknown,
  name: string,
): boolean {
  return (
    muirMoiraMutatorsFieldOf(node, 'name') === name ||
    muirMoiraMutatorsMemberNameOf(node) === name
  );
}

/**
 * An APIRequestContext, which sends requests: `<x>.request`, `<x>?.request`, or a bare `request` that a parameter
 * binds, a fixture or a helper's argument.
 */
export function muirProteusPlaywrightIsRequestContext(
  path: unknown,
  node: unknown,
): boolean {
  return (
    muirMoiraMutatorsMemberNameOf(node) === 'request' ||
    (muirMoiraMutatorsFieldOf(node, 'name') === 'request' &&
      muirMoiraMutatorsFieldOf(
        muirMoiraMutatorsBindingOf(path, 'request'),
        'kind',
      ) === 'param')
  );
}

/**
 * An APIRequest, which `newContext` is called on: `request`, `<x>.request` or `<x>?.request`. A bare `request` counts
 * however it is bound, as `import { request } from '@playwright/test'` gives one.
 */
export function muirProteusPlaywrightIsRequestFactory(node: unknown): boolean {
  return muirProteusPlaywrightIsNamedReceiver(node, 'request');
}

/** `test`, or a member chain on it such as `test.describe.serial`. */
export function muirProteusPlaywrightIsTestCallee(callee: unknown): boolean {
  if (muirMoiraMutatorsIsMember(callee)) {
    return muirProteusPlaywrightIsTestCallee(
      muirMoiraMutatorsFieldOf(callee, 'object'),
    );
  }

  return muirMoiraMutatorsFieldOf(callee, 'name') === 'test';
}

/** A node whose type names a function or a method, such as `ArrowFunctionExpression` or `ObjectMethod`. */
export function muirProteusPlaywrightIsFunctionNode(node: unknown): boolean {
  const type = muirMoiraMutatorsFieldOf(node, 'type');

  return typeof type === 'string' && /Function|Method/.test(type);
}

/** The paths around `path`, nearest first. */
export function* muirProteusPlaywrightAncestors(
  path: unknown,
): Generator<unknown, void, void> {
  for (
    let current = muirMoiraMutatorsFieldOf(path, 'parentPath');
    current != null;
    current = muirMoiraMutatorsFieldOf(current, 'parentPath')
  ) {
    yield current;
  }
}
