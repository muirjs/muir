import type { NodePath, types } from '@babel/core';

import {
  awaited,
  type Binding,
  bindingOf,
  nameOf,
  withoutTypeWrappers,
} from './nodes.ts';

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

/** Whether a receiver is a user-event: `userEvent`, `<x>.userEvent` such as the play context's, `<ns>.default` on a namespace import of `@testing-library/user-event`, or a local that `isUserEventBinding` reads as one. */
export function isUserEvent(node: types.Node, path: NodePath): boolean {
  return isUserEventUnseen(node, path, new Set());
}

/** `isUserEvent`, where `seen` holds the bindings already followed, so a local given a choice of itself ends the search. */
function isUserEventUnseen(
  node: types.Node,
  path: NodePath,
  seen: ReadonlySet<Binding>,
): boolean {
  if (
    node.type === 'MemberExpression' ||
    node.type === 'OptionalMemberExpression'
  ) {
    const name = nameOf(node.property);

    return (
      name === 'userEvent' ||
      (name === 'default' && isUserEventNamespace(node.object, path))
    );
  }

  const binding = bindingOf(node, path.scope);

  return (
    (binding !== undefined &&
      !seen.has(binding) &&
      isUserEventBinding(binding, new Set([...seen, binding]))) ||
    nameOf(node) === 'userEvent'
  );
}

/** Whether a binding holds a user-event: a userEvent import, Vitest browser's userEvent destructured under another name, a `userEvent` destructured under another name in a parameter, or a local whose one value is a user-event's `setup()` or a choice between user-events. */
function isUserEventBinding(
  binding: Binding,
  seen: ReadonlySet<Binding>,
): boolean {
  const { name } = binding.identifier;
  const declaration = binding.path;
  const source = userEventImportSource(declaration);

  if (source !== undefined) {
    return userEventModules.has(source);
  }

  if (binding.kind === 'param') {
    return (
      declaration.node.type === 'ObjectPattern' &&
      hasUserEventProperty(declaration.node, name)
    );
  }

  if (!declaration.isVariableDeclarator()) {
    return false;
  }

  const { id, init } = declaration.node;

  if (
    id.type === 'ObjectPattern' &&
    hasUserEventProperty(id, name) &&
    init !== null &&
    init !== undefined &&
    isVitestBrowserImport(awaited(init))
  ) {
    return true;
  }

  const value = boundValue(declaration, binding);

  if (value?.node.type === 'ConditionalExpression') {
    return (
      isUserEventUnseen(value.node.consequent, value.at, seen) &&
      isUserEventUnseen(value.node.alternate, value.at, seen)
    );
  }

  const receiver = setupReceiver(value?.node);

  return (
    value !== undefined &&
    receiver !== undefined &&
    isUserEventUnseen(receiver, value.at, seen)
  );
}

/** The module an import declaration names when `declaration` imports `userEvent` by name from it, or imports the default export of `@testing-library/user-event`, the one user-event module with a default export, as a default import or by the name `default`. */
function userEventImportSource(declaration: NodePath): string | undefined {
  const { node, parent } = declaration;

  if (parent.type !== 'ImportDeclaration') {
    return undefined;
  }

  const source = parent.source.value;
  const imported =
    node.type === 'ImportSpecifier'
      ? nameOf(node.imported)
      : node.type === 'ImportDefaultSpecifier'
        ? 'default'
        : undefined;
  const importsUserEvent =
    imported === 'userEvent' ||
    (imported === 'default' && source === defaultExportModule);

  return importsUserEvent ? source : undefined;
}

/** The one user-event module with a default export. */
const defaultExportModule = '@testing-library/user-event';

/** Whether `node` names a namespace import of the user-event module with a default export, whose `default` member is a user-event. */
function isUserEventNamespace(node: types.Node, path: NodePath): boolean {
  const declaration = bindingOf(withoutTypeWrappers(node), path.scope)?.path;

  return (
    declaration?.node.type === 'ImportNamespaceSpecifier' &&
    declaration.parent.type === 'ImportDeclaration' &&
    declaration.parent.source.value === defaultExportModule
  );
}

/** Whether a pattern's properties hold `userEvent: <name>` or `userEvent: <name> = <default>`. */
function hasUserEventProperty(
  pattern: types.ObjectPattern,
  name: string,
): boolean {
  return pattern.properties.some(
    (property) =>
      property.type === 'ObjectProperty' &&
      nameOf(property.key) === 'userEvent' &&
      nameOf(
        property.value.type === 'AssignmentPattern'
          ? property.value.left
          : property.value,
      ) === name,
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

/** The modules whose `userEvent` export is a user-event. */
const userEventModules: ReadonlySet<string> = new Set([
  'storybook/test',
  '@testing-library/user-event',
  ...vitestBrowserSources,
]);

/** A value and where it is given, whose scope its names are read in. */
interface GivenValue {
  readonly node: types.Node;
  readonly at: NodePath;
}

/** The one value a local is ever given, by its declaration's `init` or a later assignment; none when something else, such as `++` or a `for...of` head, also changes it. */
function boundValue(
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

/** The receiver of `<x>.setup()`. */
function setupReceiver(node: types.Node | undefined): types.Node | undefined {
  return node?.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    nameOf(node.callee.property) === 'setup'
    ? node.callee.object
    : undefined;
}
