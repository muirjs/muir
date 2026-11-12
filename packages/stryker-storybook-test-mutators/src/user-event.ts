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
      : userEventBinding(binding, new Set([...seen, binding]));

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
  seen: ReadonlySet<Binding>,
): UserEventReading {
  const { name } = binding.identifier;
  const declaration = binding.path;

  const source = userEventImportSource(declaration);

  if (source !== undefined) {
    return userEvent14Sources.has(source)
      ? 'provenUserEvent14'
      : vitestBrowserSources.has(source)
        ? 'userEvent'
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

  const value = boundValue(declaration, binding);

  if (value?.node.type === 'ConditionalExpression') {
    return weaker(
      readUserEvent(value.node.consequent, value.at, seen),
      readUserEvent(value.node.alternate, value.at, seen),
    );
  }

  const receiver = setupReceiver(value?.node);

  return value === undefined || receiver === undefined
    ? 'none'
    : readUserEvent(receiver, value.at, seen);
}

/** The module an import declaration names when `declaration` imports `userEvent` by name from it, or is the default import of `@testing-library/user-event`, the one user-event module with a default export. */
function userEventImportSource(declaration: NodePath): string | undefined {
  const { node, parent } = declaration;

  if (parent?.type !== 'ImportDeclaration') {
    return undefined;
  }

  const source = parent.source.value;
  const importsUserEvent =
    node.type === 'ImportSpecifier'
      ? nameOf(node.imported) === 'userEvent'
      : node.type === 'ImportDefaultSpecifier' &&
        source === '@testing-library/user-event';

  return importsUserEvent ? source : undefined;
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
    binding.path.isIdentifier() &&
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
