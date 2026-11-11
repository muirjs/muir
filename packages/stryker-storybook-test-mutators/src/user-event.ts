import type { NodePath, types } from '@babel/core';

import { awaited, type Binding, nameOf } from './nodes.ts';

// The user-event methods that act on the page: those of user-event 14 (@testing-library/user-event, which
// storybook/test re-exports) and those only Vitest browser's userEvent has.
export const userEventMethods: ReadonlySet<string> = new Set([
  'fill',
  'dragAndDrop',
  'wheel',
  'click',
  'dblClick',
  'tripleClick',
  'hover',
  'unhover',
  'tab',
  'keyboard',
  'pointer',
  'type',
  'clear',
  'selectOptions',
  'deselectOptions',
  'upload',
  'copy',
  'cut',
  'paste',
]);

interface UserEventReading {
  readonly isUserEvent: boolean;
  readonly mayBeVitestBrowser: boolean;
}

const noUserEvent: UserEventReading = {
  isUserEvent: false,
  mayBeVitestBrowser: false,
};

/** Reads `userEvent`, `<x>.userEvent` such as the play context's, or a local that `userEventBinding` reads as a user-event. `seen` holds the bindings already followed, so a local given a choice of itself ends the search. */
export function readUserEvent(
  node: types.Node,
  path: NodePath,
  seen: ReadonlySet<Binding> = new Set(),
): UserEventReading {
  if (node.type === 'MemberExpression') {
    return {
      isUserEvent: nameOf(node.property) === 'userEvent',
      mayBeVitestBrowser:
        isVitestBrowserNamespace(node.object, path) ||
        isVitestBrowserImport(awaited(node.object)),
    };
  }

  const name = nameOf(node);
  const binding = name === undefined ? undefined : path.scope.getBinding(name);
  const bound =
    binding === undefined || seen.has(binding)
      ? noUserEvent
      : userEventBinding(binding, path, new Set([...seen, binding]));

  return {
    isUserEvent: name === 'userEvent' || bound.isUserEvent,
    mayBeVitestBrowser: bound.mayBeVitestBrowser,
  };
}

/** Reads what a binding holds: Vitest browser's userEvent imported or destructured under another name, a context's userEvent destructured under another name in a parameter, or a local whose one value is a user-event's `setup()` or a choice between user-events. */
function userEventBinding(
  binding: Binding,
  path: NodePath,
  seen: ReadonlySet<Binding>,
): UserEventReading {
  const { name } = binding.identifier;
  const declaration = binding.path;

  if (declaration.isImportSpecifier()) {
    const { parent } = declaration;
    const fromVitestBrowser =
      nameOf(declaration.node.imported) === 'userEvent' &&
      parent.type === 'ImportDeclaration' &&
      vitestBrowserSources.has(parent.source.value);

    return {
      isUserEvent: fromVitestBrowser,
      mayBeVitestBrowser: fromVitestBrowser,
    };
  }

  if (binding.kind === 'param') {
    return {
      isUserEvent:
        declaration.node.type === 'ObjectPattern' &&
        takesUserEventAs(declaration.node, name),
      mayBeVitestBrowser: false,
    };
  }

  if (!declaration.isVariableDeclarator()) {
    return noUserEvent;
  }

  const { id, init } = declaration.node;

  if (
    id.type === 'ObjectPattern' &&
    takesUserEventAs(id, name) &&
    init !== null &&
    init !== undefined &&
    isVitestBrowserImport(awaited(init))
  ) {
    return { isUserEvent: true, mayBeVitestBrowser: true };
  }

  const value = boundValue(init, binding);

  if (value?.type === 'ConditionalExpression') {
    const consequent = readUserEvent(value.consequent, path, seen);
    const alternate = readUserEvent(value.alternate, path, seen);

    return {
      isUserEvent: consequent.isUserEvent && alternate.isUserEvent,
      mayBeVitestBrowser:
        consequent.mayBeVitestBrowser || alternate.mayBeVitestBrowser,
    };
  }

  const receiver = setupReceiver(value);

  return receiver === undefined
    ? noUserEvent
    : readUserEvent(receiver, path, seen);
}

/** `{ userEvent: <name> }`, among other properties. */
function takesUserEventAs(pattern: types.ObjectPattern, name: string): boolean {
  return pattern.properties.some(
    (property) =>
      property.type === 'ObjectProperty' &&
      nameOf(property.key) === 'userEvent' &&
      nameOf(property.value) === name,
  );
}

/** `<name>` from `import * as <name> from 'vitest/browser'`. */
function isVitestBrowserNamespace(node: types.Node, path: NodePath): boolean {
  const name = nameOf(node);
  const binding = name === undefined ? undefined : path.scope.getBinding(name);
  const declaration = binding?.path.parent;

  return (
    binding?.path.node.type === 'ImportNamespaceSpecifier' &&
    declaration?.type === 'ImportDeclaration' &&
    vitestBrowserSources.has(declaration.source.value)
  );
}

/** `import('vitest/browser')` or its Vitest 3 name, an `ImportExpression` as Babel 8 parses it. */
function isVitestBrowserImport(node: types.Node): boolean {
  return (
    node.type === 'ImportExpression' &&
    node.source.type === 'StringLiteral' &&
    vitestBrowserSources.has(node.source.value)
  );
}

const vitestBrowserSources: ReadonlySet<string> = new Set([
  'vitest/browser',
  '@vitest/browser/context',
]);

/** The receiver of `<x>.setup()`. */
function setupReceiver(node: types.Node | undefined): types.Node | undefined {
  return node?.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    nameOf(node.callee.property) === 'setup'
    ? node.callee.object
    : undefined;
}

/** The one value a local is ever given, by its declaration's `init` or a later assignment; none when something else, such as `++` or a `for...of` head, also changes it. */
function boundValue(
  init: types.Node | null | undefined,
  binding: Binding,
): types.Node | undefined {
  const assigned = binding.constantViolations.flatMap(({ node }) =>
    node.type === 'AssignmentExpression' ? [node.right] : [],
  );

  if (assigned.length < binding.constantViolations.length) {
    return undefined;
  }

  const values = [init, ...assigned].filter(
    (value) => value !== null && value !== undefined,
  );

  return values.length === 1 ? values[0] : undefined;
}
