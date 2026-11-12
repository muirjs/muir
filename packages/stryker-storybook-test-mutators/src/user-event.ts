import type { NodePath, types } from '@babel/core';

import { awaited, type Binding, bindingOf, keyName, nameOf } from './nodes.ts';
import { isInStoryTestCode } from './story-file.ts';

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

/** What a receiver is: no user-event, a user-event that may be Vitest browser's, whose `type` does not click, or a proven user-event 14, whose `type` clicks first. */
type UserEventReading = 'none' | 'userEvent' | 'provenUserEvent14';

/** Reads `userEvent`, `<x>.userEvent` such as the play context's, or a local that `userEventBinding` reads as a user-event. `seen` holds the bindings already followed, so a local given a choice of itself ends the search. */
export function readUserEvent(
  node: types.Node,
  path: NodePath,
  seen: ReadonlySet<Binding> = new Set(),
): UserEventReading {
  if (node.type === 'MemberExpression') {
    if (nameOf(node.property) !== 'userEvent') {
      return 'none';
    }

    return isPlayContext(node.object, path) ? 'provenUserEvent14' : 'userEvent';
  }

  const binding = bindingOf(node, path.scope);
  const bound =
    binding === undefined || seen.has(binding)
      ? 'none'
      : userEventBinding(binding, path, new Set([...seen, binding]));

  return bound === 'none' && nameOf(node) === 'userEvent' ? 'userEvent' : bound;
}

/** The weaker of two readings, as a choice between them is only as proven as its weaker side. */
function weaker(
  first: UserEventReading,
  second: UserEventReading,
): UserEventReading {
  if (first === 'none' || second === 'none') {
    return 'none';
  }

  return first === second ? first : 'userEvent';
}

/** Reads what a binding holds: a userEvent import, Vitest browser's userEvent destructured under another name, a context's userEvent destructured under another name in a parameter, or a local whose one value is a user-event's `setup()` or a choice between user-events. */
function userEventBinding(
  binding: Binding,
  path: NodePath,
  seen: ReadonlySet<Binding>,
): UserEventReading {
  const { name } = binding.identifier;
  const declaration = binding.path;

  if (declaration.isImportSpecifier()) {
    const { parent } = declaration;
    const source =
      nameOf(declaration.node.imported) === 'userEvent' &&
      parent.type === 'ImportDeclaration'
        ? parent.source.value
        : undefined;
    if (source !== undefined && userEvent14Sources.has(source)) {
      return 'provenUserEvent14';
    }

    return source !== undefined && vitestBrowserSources.has(source)
      ? 'userEvent'
      : 'none';
  }

  if (declaration.isImportDefaultSpecifier()) {
    const { parent } = declaration;

    return parent.type === 'ImportDeclaration' &&
      parent.source.value === '@testing-library/user-event'
      ? 'provenUserEvent14'
      : 'none';
  }

  if (binding.kind === 'param') {
    if (
      declaration.node.type !== 'ObjectPattern' ||
      !takesUserEventAs(declaration.node, name)
    ) {
      return 'none';
    }

    return isPlayParameter(declaration) ? 'provenUserEvent14' : 'userEvent';
  }

  if (!declaration.isVariableDeclarator()) {
    return 'none';
  }

  const { id, init } = declaration.node;

  if (
    id.type === 'ObjectPattern' &&
    takesUserEventAs(id, name) &&
    init !== null &&
    init !== undefined &&
    isVitestBrowserImport(awaited(init))
  ) {
    return 'userEvent';
  }

  const value = boundValue(init, binding);

  if (value?.type === 'ConditionalExpression') {
    return weaker(
      readUserEvent(value.consequent, path, seen),
      readUserEvent(value.alternate, path, seen),
    );
  }

  const receiver = setupReceiver(value);

  return receiver === undefined ? 'none' : readUserEvent(receiver, path, seen);
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

/** A play's context parameter, not destructured. */
function isPlayContext(node: types.Node, path: NodePath): boolean {
  const binding = bindingOf(node, path.scope);

  return (
    binding?.kind === 'param' &&
    binding.path.node === binding.identifier &&
    isPlayParameter(binding.path)
  );
}

/** A parameter of a play that Storybook calls: a `play` method, or a function given as a `play` property, which is story test code and inside none. */
function isPlayParameter(parameter: NodePath): boolean {
  const play = parameter.parentPath;
  const parent = play?.parent;
  const key =
    play?.node.type === 'ObjectMethod'
      ? play.node.key
      : parent?.type === 'ObjectProperty'
        ? parent.key
        : undefined;

  return (
    parameter.key === 0 &&
    play !== null &&
    key !== undefined &&
    keyName(key) === 'play' &&
    isInStoryTestCode(parameter) &&
    !isInStoryTestCode(play)
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

const userEvent14Sources: ReadonlySet<string> = new Set([
  'storybook/test',
  '@testing-library/user-event',
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
