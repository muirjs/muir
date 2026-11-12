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

  if (bound === 'none') {
    return nameOf(node) === 'userEvent' ? 'unprovenUserEvent' : 'none';
  }

  return bound === 'provenUserEvent14' && !isOnlyCalledOn(binding)
    ? 'unprovenUserEvent'
    : bound;
}

/** A binding whose every reference is a method call's receiver or a side of a choice given to such a local. */
function isOnlyCalledOn(
  binding: Binding | undefined,
  seen: ReadonlySet<Binding> = new Set(),
): boolean {
  return (
    binding !== undefined &&
    binding.referencePaths.every(
      (reference) =>
        isMethodCallReceiver(reference) || isChoiceSide(reference, seen),
    )
  );
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

/** An `import()` of a user-event 14 module, or of a module the file does not spell out. */
function mayImportUserEvent14(program: NodePath<types.Program>): boolean {
  let found = false;

  program.traverse({
    ImportExpression(path) {
      const { source } = path.node;

      if (source.type !== 'StringLiteral' || isUserEvent14Module(source)) {
        found = true;
        path.stop();
      }
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

/** A play's context parameter, not destructured, that holds what Storybook set. */
function isPlayContext(node: types.Node, path: NodePath): boolean {
  const binding = bindingOf(node, path.scope);

  return (
    binding?.kind === 'param' &&
    binding.path.isIdentifier() &&
    isPlayParameter(binding) &&
    isContextLeftAsSet(binding)
  );
}

/** `<context>.<name>`, or a declaration's value whose local or pattern is read as a context, where a `context` member, which Storybook sets to the context itself, is read the same way. */
function isContextRead(path: NodePath): boolean {
  const { parentPath } = path;

  if (parentPath?.isVariableDeclarator() && path.key === 'init') {
    return isContextLocal(parentPath.node.id, parentPath.scope);
  }

  if (!isMemberObject(path) || parentPath === null) {
    return false;
  }

  const name = memberName(parentPath.node);

  if (name === 'context') {
    return isContextRead(parentPath);
  }

  return (
    name !== 'userEvent' ||
    isMethodCallReceiver(parentPath) ||
    isChoiceSide(parentPath)
  );
}

function memberName(node: types.Node): string | undefined {
  return node.type === 'MemberExpression' ||
    node.type === 'OptionalMemberExpression'
    ? nameOf(node.property)
    : undefined;
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

/** The first parameter of a play that Storybook calls: a `play` method, or a function given as a `play` property, under a key that is not computed, which is story test code and inside none. */
function isPlayParameter(binding: Binding): boolean {
  const parameter = binding.path;
  const play = parameter.parentPath;
  const keyed = play === null ? undefined : keyedBy(play);

  return (
    parameter.key === 0 &&
    play !== null &&
    keyed !== undefined &&
    !keyed.computed &&
    keyName(keyed.key) === 'play' &&
    isInStoryTestCode(parameter) &&
    !isInStoryTestCode(play)
  );
}

/** The method `fn` is, or the property whose value it is. */
function keyedBy(
  fn: NodePath,
): types.ObjectMethod | types.ObjectProperty | undefined {
  if (fn.node.type === 'ObjectMethod') {
    return fn.node;
  }

  return fn.parent?.type === 'ObjectProperty' ? fn.parent : undefined;
}

/** A play's context parameter, or a local it destructures, that the play never reassigns, in a file where every context is only read, so it holds what Storybook set. */
function isContextLeftAsSet(binding: Binding): boolean {
  return (
    binding.constantViolations.length === 0 && contextsOnlyRead(binding.path)
  );
}

/** Whether every context the file can reach is only read: as `<context>.<name>` or destructured under plain keys, with its userEvent only called on, in hooks whose code the file holds. */
const contextsOnlyRead = perFile((program) => {
  let onlyRead = true;

  const check = (path: NodePath, read: boolean): void => {
    if (!read) {
      onlyRead = false;
      path.stop();
    }
  };

  program.traverse({
    AssignmentExpression(path) {
      const { left } = path.node;
      const positions =
        left.type === 'MemberExpression' && !left.computed
          ? hookPositions(left.property, false)
          : [];

      check(
        path,
        positions.every((position) =>
          isHookValueRead(path.get('right'), position),
        ),
      );
    },
    CallExpression(path) {
      const { callee } = path.node;
      const name =
        callee.type === 'MemberExpression' && !callee.computed
          ? nameOf(callee.property)
          : nameOf(callee);
      const [, callback] = path.get('arguments');

      check(
        path,
        name !== 'step' ||
          callback === undefined ||
          isHookValueRead(callback, 0),
      );
      check(path, name !== 'useStoryContext' || isContextRead(path));
    },
    ObjectMethod(path) {
      check(
        path,
        hookPositions(path.node.key, path.node.computed).every((position) =>
          isContextParameterRead(path, position),
        ),
      );
    },
    ObjectProperty(path) {
      const value = path.get('value');
      const positions =
        path.node.computed && !value.isFunction()
          ? []
          : hookPositions(path.node.key, path.node.computed);

      check(
        path,
        positions.every((position) => isHookValueRead(value, position)),
      );
    },
  });

  return onlyRead;
}, false);

/** A hook value, or an array of them, whose every function the file holds and reads its context in. */
function isHookValueRead(value: NodePath, position: number): boolean {
  const hooks = value.isArrayExpression() ? value.get('elements') : [value];

  return hooks.every((hook) => {
    const fn = hookFunction(hook);

    return fn !== undefined && isContextParameterRead(fn, position);
  });
}

/** The function a hook value is: given inline, or by the name of a local function the file never reassigns. */
function hookFunction(
  hook: NodePath<types.Node | null>,
): NodePath<types.Function> | undefined {
  if (hook.isFunction()) {
    return hook;
  }

  const binding =
    hook.node === null ? undefined : bindingOf(hook.node, hook.scope);
  const declaration = binding?.path;

  if (declaration?.isFunctionDeclaration()) {
    return declaration;
  }

  const init = declaration?.isVariableDeclarator()
    ? declaration.get('init')
    : undefined;

  return binding?.constantViolations.length === 0 && init?.isFunction()
    ? init
    : undefined;
}

/** Where a hook given under this key takes the story context: each place a hook may take it under a computed key, as that key may name any hook. */
function hookPositions(key: types.Node, computed: boolean): readonly number[] {
  if (computed) {
    return [...new Set(contextPositions.values())];
  }

  const name = keyName(key);
  const position = name === undefined ? undefined : contextPositions.get(name);

  return position === undefined ? [] : [position];
}

/** The parameter that holds the story context in each hook Storybook calls with it: a decorator's and a render function's second. */
const contextPositions: ReadonlyMap<string, number> = new Map([
  ['play', 0],
  ['beforeEach', 0],
  ['loaders', 0],
  ['decorators', 1],
  ['render', 1],
]);

function isContextParameterRead(
  hook: NodePath<types.Function>,
  position: number,
): boolean {
  const parameter = hook.node.params[position];

  if (parameter !== undefined) {
    return isContextLocal(parameter, hook.scope);
  }

  return (
    !hook.node.params.some((earlier) => earlier.type === 'RestElement') &&
    !readsArguments(hook)
  );
}

function readsArguments(hook: NodePath<types.Function>): boolean {
  let reads = false;

  hook.traverse({
    Identifier(path) {
      if (path.node.name === 'arguments' && path.isReferencedIdentifier()) {
        reads = true;
        path.stop();
      }
    },
  });

  return reads;
}

/** A destructuring of a context under plain keys, whose `userEvent` local is only called on. */
function isReadPattern(
  pattern: types.ObjectPattern,
  scope: NodePath['scope'],
): boolean {
  return pattern.properties.every((property) => {
    if (property.type !== 'ObjectProperty' || property.computed) {
      return false;
    }

    const local =
      property.value.type === 'AssignmentPattern'
        ? property.value.left
        : property.value;

    const name = keyName(property.key);

    if (name === 'userEvent') {
      return isOnlyCalledOn(bindingOf(local, scope));
    }

    return name !== 'context' || isContextLocal(local, scope);
  });
}

/** A local or pattern that a context is given to, read as a context. */
function isContextLocal(local: types.Node, scope: NodePath['scope']): boolean {
  if (local.type === 'ObjectPattern') {
    return isReadPattern(local, scope);
  }

  const binding = bindingOf(local, scope);

  return binding !== undefined && binding.referencePaths.every(isContextRead);
}

/** What the user-event proofs read once per file, at the Program. */
export const userEventFileReaders: readonly ((path: NodePath) => boolean)[] = [
  contextsOnlyRead,
  importsOnlyCallUserEvent,
];

/** `<path>.<method>(...)`, optional or not. */
function isMethodCallReceiver(path: NodePath): boolean {
  return isMemberObject(path) && path.parentPath?.key === 'callee';
}

/** A side of `<test> ? <a> : <b>` that is the one value of a local only called on. */
function isChoiceSide(
  path: NodePath,
  seen: ReadonlySet<Binding> = new Set(),
): boolean {
  const choice = path.parentPath;

  if (!choice?.isConditionalExpression() || path.key === 'test') {
    return false;
  }

  const local = localGiven(choice);
  const value =
    local?.path.isVariableDeclarator() === true
      ? boundValue(local.path, local)
      : undefined;

  return (
    local !== undefined &&
    value?.node === choice.node &&
    (seen.has(local) || isOnlyCalledOn(local, new Set([...seen, local])))
  );
}

/** The local that `value` is given to, by a declaration's `init` or the right side of an assignment. */
function localGiven(value: NodePath): Binding | undefined {
  const { parentPath } = value;

  if (parentPath?.isVariableDeclarator() && value.key === 'init') {
    return bindingOf(parentPath.node.id, parentPath.scope);
  }

  return parentPath?.isAssignmentExpression() && value.key === 'right'
    ? bindingOf(parentPath.node.left, parentPath.scope)
    : undefined;
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
