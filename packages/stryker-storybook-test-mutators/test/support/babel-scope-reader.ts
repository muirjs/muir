// The interaction kind rules read through Babel's `path.scope`, which `reader-differential.test.ts` checks core's own
// scope model against.
import type { NodePath, types } from '@babel/core';

type Binding = NonNullable<ReturnType<NodePath['scope']['getBinding']>>;

type CallNode = types.CallExpression | types.OptionalCallExpression;

type TypeWrapper =
  | types.TSNonNullExpression
  | types.TSAsExpression
  | types.TSSatisfiesExpression
  | types.TSTypeAssertion
  | types.ParenthesizedExpression;

/** What an interaction's call is. A fireEvent call's `method` is its event when the call names it as `fireEvent.<event>`. */
export type InteractionKind =
  | { readonly kind: 'userEvent'; readonly method: string }
  | { readonly kind: 'fireEvent'; readonly method: string | undefined }
  | { readonly kind: 'composedPlay' | 'rawDom' };

function isTypeWrapper(node: types.Node): node is TypeWrapper {
  return (
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'ParenthesizedExpression'
  );
}

function withoutTypeWrappers(node: types.Node): types.Node {
  return isTypeWrapper(node) ? withoutTypeWrappers(node.expression) : node;
}

function awaited(node: types.Node): types.Node {
  const expression = withoutTypeWrappers(node);

  return withoutTypeWrappers(
    expression.type === 'AwaitExpression' ? expression.argument : expression,
  );
}

function nameOf(node: types.Node): string | undefined {
  return node.type === 'Identifier' ? node.name : undefined;
}

function bindingOf(
  node: types.Node,
  scope: NodePath['scope'],
): Binding | undefined {
  const name = nameOf(node);

  return name === undefined ? undefined : scope.getBinding(name);
}

const userEventMethods: ReadonlySet<string> = new Set([
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

function isUserEvent(
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
      isUserEvent(value.node.consequent, value.at, seen) &&
      isUserEvent(value.node.alternate, value.at, seen)
    );
  }

  const receiver = setupReceiver(value?.node);

  return (
    value !== undefined &&
    receiver !== undefined &&
    isUserEvent(receiver, value.at, seen)
  );
}

function userEventImportSource(declaration: NodePath): string | undefined {
  const { node, parent } = declaration;

  if (parent.type !== 'ImportDeclaration') {
    return undefined;
  }

  const source = parent.source.value;
  const imported = importedName(node);
  const importsUserEvent =
    imported === 'userEvent' ||
    (imported === 'default' && source === userEventDefaultExportModule);

  return importsUserEvent ? source : undefined;
}

function importedName(specifier: types.Node): string | undefined {
  if (specifier.type === 'ImportDefaultSpecifier') {
    return 'default';
  }

  if (specifier.type !== 'ImportSpecifier') {
    return undefined;
  }

  return specifier.imported.type === 'StringLiteral'
    ? specifier.imported.value
    : nameOf(specifier.imported);
}

const userEventDefaultExportModule = '@testing-library/user-event';

function isUserEventNamespace(node: types.Node, path: NodePath): boolean {
  const declaration = bindingOf(withoutTypeWrappers(node), path.scope)?.path;

  return (
    declaration?.node.type === 'ImportNamespaceSpecifier' &&
    declaration.parent.type === 'ImportDeclaration' &&
    declaration.parent.source.value === userEventDefaultExportModule
  );
}

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

const userEventModules: ReadonlySet<string> = new Set([
  'storybook/test',
  userEventDefaultExportModule,
  ...vitestBrowserSources,
]);

interface GivenValue {
  readonly node: types.Node;
  readonly at: NodePath;
}

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

function setupReceiver(node: types.Node | undefined): types.Node | undefined {
  return node?.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    nameOf(node.callee.property) === 'setup'
    ? node.callee.object
    : undefined;
}

function isMember(
  node: types.Node,
): node is types.MemberExpression | types.OptionalMemberExpression {
  return (
    node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression'
  );
}

function startsAtIdentifier(node: types.Node): boolean {
  return (
    node.type === 'Identifier' ||
    (isMember(node) && startsAtIdentifier(node.object))
  );
}

function isStepCall(node: types.Node): boolean {
  if (node.type !== 'CallExpression') {
    return false;
  }

  const { callee } = node;

  return (
    nameOf(callee) === 'step' ||
    (callee.type === 'MemberExpression' &&
      callee.object.type === 'Identifier' &&
      nameOf(callee.property) === 'step')
  );
}

function isStepBody(path: NodePath): boolean {
  const arrow: NodePath | null = path.parentPath;

  return (
    arrow?.node.type === 'ArrowFunctionExpression' &&
    arrow.node.body === path.node &&
    path.isExpression() &&
    isStepCall(arrow.parent)
  );
}

function isStoryPlay(argument: types.Node | undefined): boolean {
  if (argument === undefined) {
    return false;
  }

  const node = withoutTypeWrappers(argument);

  return (
    isMember(node) &&
    startsAtIdentifier(node.object) &&
    nameOf(node.property) === 'play'
  );
}

const rawDomArguments: ReadonlyMap<string, number> = new Map([
  ['focus', 0],
  ['blur', 0],
  ['click', 0],
  ['dispatchEvent', 1],
]);

const composedPlayMethods: ReadonlySet<string> = new Set(['play', 'run']);

function kindOf(
  call: CallNode,
  path: NodePath,
  testCode: ReadonlySet<unknown>,
): InteractionKind | undefined {
  const member = isMember(call.callee) ? call.callee : undefined;
  const method = member === undefined ? undefined : nameOf(member.property);

  if (
    member !== undefined &&
    method !== undefined &&
    userEventMethods.has(method) &&
    isUserEvent(withoutTypeWrappers(member.object), path, new Set())
  ) {
    return { kind: 'userEvent', method };
  }

  const callee = withoutTypeWrappers(call.callee);

  if (!isMember(callee)) {
    if (nameOf(callee) === 'fireEvent') {
      return { kind: 'fireEvent', method };
    }

    return nameOf(callee) === 'step' && isStoryPlay(call.arguments[1])
      ? { kind: 'composedPlay' }
      : undefined;
  }

  if (nameOf(withoutTypeWrappers(callee.object)) === 'fireEvent') {
    return { kind: 'fireEvent', method };
  }

  const name = nameOf(callee.property);

  if (name === undefined) {
    return undefined;
  }

  const isComposedPlay = composedPlayMethods.has(name);
  const matches = isComposedPlay
    ? startsAtIdentifier(callee.object)
    : rawDomArguments.get(name) === call.arguments.length;
  const inTestCode =
    path.findParent((parent) => testCode.has(parent.node)) !== null;

  return matches && inTestCode
    ? { kind: isComposedPlay ? 'composedPlay' : 'rawDom' }
    : undefined;
}

/** The kind of the interaction whose statement is `path`: an expression statement, or the expression body of an arrow given to `step(...)`. `testCode` is the file's story test code. */
export function interactionKindAt(
  path: NodePath,
  testCode: ReadonlySet<unknown>,
): InteractionKind | undefined {
  const expression = path.isExpressionStatement()
    ? path.node.expression
    : isStepBody(path)
      ? path.node
      : undefined;
  const call = expression === undefined ? undefined : awaited(expression);

  return call?.type === 'CallExpression' ||
    call?.type === 'OptionalCallExpression'
    ? kindOf(call, path, testCode)
    : undefined;
}
