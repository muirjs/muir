import type { NodePath, types } from '@babel/core';
import { awaited, type Binding, bindingOf, keyName, nameOf } from './nodes.ts';
import { isInStoryTestCode, perFile } from './story-file.ts';

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
type UserEventReading = 'none' | 'unprovenUserEvent' | 'provenUserEvent14';

/** Reads `userEvent`, `<x>.userEvent` such as the play context's, or a local that `userEventBinding` reads as a user-event. `seen` holds the bindings already followed, so a local given a choice of itself ends the search. */
export function readUserEvent(
  node: types.Node,
  path: NodePath,
  seen: ReadonlySet<Binding> = new Set(),
): UserEventReading {
  if (
    node.type === 'MemberExpression' ||
    node.type === 'OptionalMemberExpression'
  ) {
    if (nameOf(node.property) !== 'userEvent') {
      return 'none';
    }

    return isPlayContext(node.object, path)
      ? 'provenUserEvent14'
      : 'unprovenUserEvent';
  }

  const binding = bindingOf(node, path.scope);
  const bound =
    binding === undefined || seen.has(binding)
      ? 'none'
      : userEventBinding(binding, new Set([...seen, binding]));

  return bound === 'none' && nameOf(node) === 'userEvent'
    ? 'unprovenUserEvent'
    : bound;
}

/** The weaker of two readings, as a choice between them is only as proven as its weaker side. */
function weaker(
  first: UserEventReading,
  second: UserEventReading,
): UserEventReading {
  if (first === 'none' || second === 'none') {
    return 'none';
  }

  return first === second ? first : 'unprovenUserEvent';
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
    return importReadings.get(source) ?? 'none';
  }

  if (binding.kind === 'param') {
    const property =
      declaration.node.type === 'ObjectPattern'
        ? userEventProperty(declaration.node, name)
        : undefined;

    if (property === undefined) {
      return 'none';
    }

    return property.value.type !== 'AssignmentPattern' &&
      isPlayParameter(binding)
      ? 'provenUserEvent14'
      : 'unprovenUserEvent';
  }

  if (!declaration.isVariableDeclarator()) {
    return 'none';
  }

  const { id, init } = declaration.node;

  if (
    id.type === 'ObjectPattern' &&
    userEventProperty(id, name) !== undefined &&
    init !== null &&
    init !== undefined &&
    isVitestBrowserImport(awaited(init))
  ) {
    return 'unprovenUserEvent';
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

/** The `userEvent: <name>` or `userEvent: <name> = <default>` among a pattern's properties. */
function userEventProperty(
  pattern: types.ObjectPattern,
  name: string,
): types.ObjectProperty | undefined {
  return pattern.properties.find(
    (property): property is types.ObjectProperty =>
      property.type === 'ObjectProperty' &&
      nameOf(property.key) === 'userEvent' &&
      nameOf(
        property.value.type === 'AssignmentPattern'
          ? property.value.left
          : property.value,
      ) === name,
  );
}

/** A play's context parameter, not destructured, that the play only reads members of. */
function isPlayContext(node: types.Node, path: NodePath): boolean {
  const binding = bindingOf(node, path.scope);

  return (
    binding?.kind === 'param' &&
    binding.path.isIdentifier() &&
    binding.referencePaths.every(isMemberObject) &&
    isPlayParameter(binding)
  );
}

/** `<path>.<name>` or `<path>?.<name>`. */
function isMemberObject(path: NodePath): boolean {
  const { parentPath } = path;

  return (
    path.key === 'object' &&
    parentPath !== null &&
    (parentPath.isMemberExpression() ||
      parentPath.isOptionalMemberExpression()) &&
    !parentPath.node.computed
  );
}

/** A parameter that the file never reassigns, of a play that Storybook calls: a `play` method, or a function given as a `play` property, under a key that is not computed, which is story test code and inside none, in a file that only reads the play context's userEvent. */
function isPlayParameter(binding: Binding): boolean {
  const parameter = binding.path;
  const play = parameter.parentPath;
  const parent = play?.parent;
  const keyed =
    play?.node.type === 'ObjectMethod'
      ? play.node
      : parent?.type === 'ObjectProperty'
        ? parent
        : undefined;

  return (
    binding.constantViolations.length === 0 &&
    parameter.key === 0 &&
    play !== null &&
    keyed !== undefined &&
    !keyed.computed &&
    keyName(keyed.key) === 'play' &&
    isInStoryTestCode(parameter) &&
    !isInStoryTestCode(play) &&
    !changesUserEvent(parameter)
  );
}

/** Whether the file names `userEvent` anywhere it may change it, as a play or a hook given the play's context may replace the user-event that Storybook sets there. */
export const changesUserEvent = perFile((program) => {
  let changes = false;

  program.traverse({
    Identifier(path) {
      if (path.node.name === 'userEvent' && !readsUserEvent(path)) {
        changes = true;
        path.stop();
      }
    },
    StringLiteral(path) {
      if (path.node.value === 'userEvent') {
        changes = true;
        path.stop();
      }
    },
  });

  return changes;
}, true);

/** `userEvent` as an import's name, a key or binding in a parameter's destructuring, or a `userEvent` or `<x>.userEvent` that is only a method call's receiver or a side of a choice. */
function readsUserEvent(path: NodePath<types.Identifier>): boolean {
  const { parentPath } = path;

  if (parentPath === null) {
    return false;
  }

  if (
    parentPath.isImportSpecifier() ||
    parentPath.isImportDefaultSpecifier() ||
    (parentPath.isObjectProperty() &&
      parentPath.parentPath.isObjectPattern() &&
      parentPath.parentPath.listKey === 'params')
  ) {
    return true;
  }

  const read =
    (parentPath.isMemberExpression() ||
      parentPath.isOptionalMemberExpression()) &&
    path.key === 'property' &&
    !parentPath.node.computed
      ? parentPath
      : path.isReferencedIdentifier()
        ? path
        : undefined;

  return (
    read !== undefined && (isMethodCallReceiver(read) || isChoiceSide(read))
  );
}

/** `<path>.<method>(...)`, optional or not. */
function isMethodCallReceiver(path: NodePath): boolean {
  return isMemberObject(path) && path.parentPath?.key === 'callee';
}

/** A side of `<test> ? <a> : <b>` given to a local that is only a method call's receiver. */
function isChoiceSide(path: NodePath): boolean {
  const choice = path.parentPath;
  const declarator = choice?.parentPath;
  const local = declarator?.isVariableDeclarator()
    ? bindingOf(declarator.node.id, declarator.scope)
    : undefined;

  return (
    choice?.isConditionalExpression() === true &&
    path.key !== 'test' &&
    local !== undefined &&
    local.referencePaths.every(isMethodCallReceiver)
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

/** What a `userEvent` import from each user-event module is. */
const importReadings: ReadonlyMap<string, UserEventReading> = new Map([
  ['storybook/test', 'provenUserEvent14'],
  ['@testing-library/user-event', 'provenUserEvent14'],
  ...[...vitestBrowserSources].map(
    (source) => [source, 'unprovenUserEvent'] as const,
  ),
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
