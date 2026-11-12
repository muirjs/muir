import type { NodePath, types } from '@babel/core';

import {
  awaited,
  type Binding,
  bindingOf,
  keyName,
  memberName,
  nameOf,
} from './nodes.ts';
import {
  boundValue,
  isChoiceSide,
  isMemberObject,
  isMethodCallReceiver,
  isOnlyCalledOn,
} from './only-called-on.ts';
import {
  contextsOnlyRead,
  isContextLeftAsSet,
  isPlayContext,
  isPlayParameter,
  namesOnlyReadUserEvent,
} from './play-context.ts';
import { perFile } from './story-file.ts';

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

  if (bound === 'none') {
    return nameOf(node) === 'userEvent' ? 'unprovenUserEvent' : 'none';
  }

  return bound === 'provenUserEvent14' && !isOnlyCalledOn(binding)
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
    const reading = importReadings.get(source) ?? 'none';

    return reading === 'provenUserEvent14' &&
      !importsOnlyCallUserEvent(declaration)
      ? 'unprovenUserEvent'
      : reading;
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
      isPlayParameter(binding) &&
      isContextLeftAsSet(binding)
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

/** Whether every import of a user-event 14 module in the file uses its userEvent only as a method call's receiver or a choice side: a named or default import of it, or a namespace import read as `<namespace>.<name>`, and no `import()` may load one. */
const importsOnlyCallUserEvent = perFile(
  (program) =>
    program
      .get('body')
      .every(
        (statement) =>
          !statement.isImportDeclaration() ||
          !isUserEvent14Module(statement.node.source) ||
          statement.get('specifiers').every(isOnlyCalledImport),
      ) && !mayImportUserEvent14(program),
  false,
);

function isUserEvent14Module(source: types.Node): boolean {
  return (
    source.type === 'StringLiteral' &&
    importReadings.get(source.value) === 'provenUserEvent14'
  );
}

/** An `import()` or `require()` of a user-event 14 module, or of a module the file does not spell out. */
function mayImportUserEvent14(program: NodePath<types.Program>): boolean {
  let found = false;

  const check = (path: NodePath, source: types.Node | undefined): void => {
    if (
      source !== undefined &&
      (source.type !== 'StringLiteral' || isUserEvent14Module(source))
    ) {
      found = true;
      path.stop();
    }
  };

  program.traverse({
    CallExpression(path) {
      const { arguments: args, callee } = path.node;

      check(path, nameOf(callee) === 'require' ? args[0] : undefined);
    },
    ImportExpression(path) {
      check(path, path.node.source);
    },
  });

  return found;
}

function isOnlyCalledImport(
  specifier: NodePath<
    | types.ImportSpecifier
    | types.ImportDefaultSpecifier
    | types.ImportNamespaceSpecifier
  >,
): boolean {
  const binding = bindingOf(specifier.node.local, specifier.scope);

  if (specifier.isImportNamespaceSpecifier()) {
    return binding !== undefined && binding.referencePaths.every(isModuleRead);
  }

  const imported = specifier.isImportSpecifier()
    ? keyName(specifier.node.imported)
    : 'default';

  return (
    (imported !== 'userEvent' && imported !== 'default') ||
    isOnlyCalledOn(binding)
  );
}

/** `<namespace>.<name>`, where a `userEvent` or `default` member is only a method call's receiver or a choice side. */
function isModuleRead(path: NodePath): boolean {
  const { parentPath } = path;

  if (!isMemberObject(path) || parentPath === null) {
    return false;
  }

  const name = memberName(parentPath.node);

  return (
    (name !== 'userEvent' && name !== 'default') ||
    isMethodCallReceiver(parentPath) ||
    isChoiceSide(parentPath)
  );
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

/** What the user-event proofs read once per file, at the Program. */
export const userEventFileReaders: readonly ((path: NodePath) => boolean)[] = [
  contextsOnlyRead,
  namesOnlyReadUserEvent,
  importsOnlyCallUserEvent,
];

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
