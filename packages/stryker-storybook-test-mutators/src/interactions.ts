import type { NodePath, types } from '@babel/core';

import type { BabelTypes } from './mutator.ts';

type Binding = NonNullable<ReturnType<NodePath['scope']['getBinding']>>;

/** `<call>;` or `await <call>;`, where the call is an interaction. */
export function isInteractionStatement(
  path: NodePath,
): path is NodePath<types.ExpressionStatement> {
  return (
    path.isExpressionStatement() &&
    isInteractionCall(awaited(path.node.expression), path)
  );
}

/** An interaction statement that is no skipped interaction. */
export function isUnskippedInteraction(
  path: NodePath,
  t: BabelTypes,
): path is NodePath<types.ExpressionStatement> {
  return isInteractionStatement(path) && !isSkipped(path, t);
}

/** The expression body of an arrow passed to `step(...)`, `<call>` or `await <call>`, where the call is an interaction. */
export function isInteractionBody(
  path: NodePath,
): path is NodePath<types.Expression> {
  return isStepBody(path) && isInteractionCall(awaited(path.node), path);
}

/** An interaction body that is no skipped interaction. */
export function isUnskippedInteractionBody(
  path: NodePath,
  t: BabelTypes,
): path is NodePath<types.Expression> {
  return isInteractionBody(path) && !isSkipped(path, t);
}

/** The expression body of an arrow passed to `step(...)`. */
function isStepBody(path: NodePath): path is NodePath<types.Expression> {
  const arrow = path.parentPath;
  const owner = arrow?.parentPath?.node;

  return (
    arrow?.node.type === 'ArrowFunctionExpression' &&
    arrow.node.body === path.node &&
    path.isExpression() &&
    owner !== undefined &&
    isStepCall(owner)
  );
}

/** The expression of an expression statement or of a step callback's expression body. */
function interactionExpression(path: NodePath): types.Node | undefined {
  if (path.isExpressionStatement()) {
    return path.node.expression;
  }

  return isStepBody(path) ? path.node : undefined;
}

/** An interaction that makes no mutant: one in a story hook, one whose following checks are all negative, a click that a type of its target repeats, or a type that a later clear undoes. */
export function isSkipped(path: NodePath, t: BabelTypes): boolean {
  return (
    path.findParent(isHook) !== null ||
    hasOnlyNegativeChecks(path) ||
    isRepeatedByNext(path, t) ||
    isClearedLater(path, t)
  );
}

/** A user-event type or clear that the next interaction, a user-event clear of the same target, undoes with no check between. */
function isClearedLater(path: NodePath, t: BabelTypes): boolean {
  const current = userEventCall(path);

  if (
    current?.target === undefined ||
    !['type', 'clear'].includes(current.method)
  ) {
    return false;
  }

  const siblings = nextSiblings(path);
  const between = untilNextInteraction(siblings);
  const next = siblings[between.length];
  const later =
    next === undefined ||
    between.some((sibling) => checksIn(sibling).length > 0)
      ? undefined
      : userEventCall(next);

  return (
    later?.method === 'clear' &&
    later.target !== undefined &&
    t.isNodesEquivalent(current.target, later.target)
  );
}

/** A user-event click or hover directly before a user-event type of the same target, which clicks it first. */
function isRepeatedByNext(path: NodePath, t: BabelTypes): boolean {
  const current = userEventCall(path);
  const [next] = nextSiblings(path);
  const following = next === undefined ? undefined : userEventCall(next);

  return (
    current?.target !== undefined &&
    following?.target !== undefined &&
    ['click', 'hover'].includes(current.method) &&
    following.method === 'type' &&
    !hasSkipClick(following.args[2]) &&
    t.isNodesEquivalent(current.target, following.target)
  );
}

/** user-event 14's `type(element, text, { skipClick })` with a `skipClick` other than `false`, which may then type without clicking first. */
function hasSkipClick(options: types.Node | undefined): boolean {
  return (
    options?.type === 'ObjectExpression' &&
    options.properties.some(
      (property) =>
        property.type === 'ObjectProperty' &&
        keyName(property.key) === 'skipClick' &&
        !(property.value.type === 'BooleanLiteral' && !property.value.value),
    )
  );
}

export interface UserEventCall {
  readonly method: string;
  readonly target: types.Node | undefined;
  readonly args: readonly types.Node[];
}

/** The method and first argument of a `<userEvent>.<method>(...)` statement or step callback body. */
export function userEventCall(path: NodePath): UserEventCall | undefined {
  const expression = interactionExpression(path);

  if (expression === undefined) {
    return undefined;
  }

  const call = awaited(expression);
  const method = userEventMethod(call, path);

  return method !== undefined && call.type === 'CallExpression'
    ? { method, target: call.arguments[0], args: call.arguments }
    : undefined;
}

/** The interaction statement or step callback body whose first argument is the call nearest around `path`, such as the query in `userEvent.click(canvas.getByRole('button', { name: 'Save' }))` around `'Save'`. */
export function targetInteraction(path: NodePath): NodePath | undefined {
  const query = path.findParent((parent) => parent.isCallExpression());
  const interaction = path.findParent(
    (parent) => parent.isStatement() || isStepBody(parent),
  );
  const expression =
    interaction === null ? undefined : interactionExpression(interaction);
  const call = expression === undefined ? undefined : awaited(expression);
  const [argument] = call?.type === 'CallExpression' ? call.arguments : [];

  return interaction !== null &&
    (isInteractionStatement(interaction) || isInteractionBody(interaction)) &&
    argument !== undefined &&
    awaited(argument) === query?.node
    ? interaction
    : undefined;
}

/** The first statement after `path` in its block that holds an `expect(...)` check, before the next interaction. */
export function firstCheckAfter(path: NodePath): NodePath | undefined {
  return untilNextInteraction(nextSiblings(path)).find(
    (sibling) => checksIn(sibling).length > 0,
  );
}

/** Whether `path` holds an `expect(...)` check with `.not` in its matcher chain. */
export function hasNegativeCheck(path: NodePath): boolean {
  return checksIn(path).some(isNegative);
}

/** `expect(...).<matcher>(...);`, awaited or not. */
export function isExpectStatement(
  path: NodePath,
): path is NodePath<types.ExpressionStatement> {
  return (
    path.isExpressionStatement() &&
    startsWithExpect(awaited(path.node.expression))
  );
}

function startsWithExpect(node: types.Node): boolean {
  if (node.type === 'CallExpression') {
    return nameOf(node.callee) === 'expect' || startsWithExpect(node.callee);
  }

  return node.type === 'MemberExpression' && startsWithExpect(node.object);
}

/** The event of a `fireEvent.<event>(...)` statement or step callback body. */
export function fireEventMethod(path: NodePath): string | undefined {
  const expression = interactionExpression(path);

  if (expression === undefined) {
    return undefined;
  }

  const call = awaited(expression);

  return call.type === 'CallExpression' &&
    call.callee.type === 'MemberExpression' &&
    nameOf(call.callee.object) === 'fireEvent'
    ? nameOf(call.callee.property)
    : undefined;
}

/** The method of a `<userEvent>.<method>(...)` call that acts on the page. */
function userEventMethod(call: types.Node, path: NodePath): string | undefined {
  if (
    (call.type !== 'CallExpression' &&
      call.type !== 'OptionalCallExpression') ||
    (call.callee.type !== 'MemberExpression' &&
      call.callee.type !== 'OptionalMemberExpression')
  ) {
    return undefined;
  }

  const method = nameOf(call.callee.property);

  return method !== undefined &&
    userEventMethods.has(method) &&
    isUserEvent(call.callee.object, path)
    ? method
    : undefined;
}

/** The statements after `path`, up to the next interaction, hold an `expect(...)` check, and each one has `.not` in its matcher chain. */
function hasOnlyNegativeChecks(path: NodePath): boolean {
  const checks = untilNextInteraction(followingStatements(path)).flatMap(
    checksIn,
  );

  return checks.length > 0 && checks.every(isNegative);
}

/** A `step(...)` statement whose callback holds an interaction. */
function isStepWithInteraction(statement: NodePath): boolean {
  const { node } = statement;

  if (
    node.type !== 'ExpressionStatement' ||
    !isStepCall(awaited(node.expression))
  ) {
    return false;
  }

  let found = false;

  statement.traverse({
    enter(inner) {
      if (isInteractionStatement(inner) || isInteractionBody(inner)) {
        found = true;
        inner.stop();
      }
    },
  });

  return found;
}

/** The statements before the first interaction statement or step with an interaction among them. */
function untilNextInteraction(
  statements: readonly NodePath[],
): readonly NodePath[] {
  const end = statements.findIndex(
    (statement) =>
      isInteractionStatement(statement) || isStepWithInteraction(statement),
  );

  return end === -1 ? statements : statements.slice(0, end);
}

/** The statements that run after `path` in its function, and after the step call when that function is a step callback. */
function followingStatements(path: NodePath): readonly NodePath[] {
  const siblings = nextSiblings(path);
  const parent = path.parentPath;

  if (parent === null) {
    return siblings;
  }

  if (!parent.isFunction()) {
    return [...siblings, ...followingStatements(parent)];
  }

  const owner = parent.parentPath;

  return owner !== null && isStepCall(owner.node)
    ? [...siblings, ...followingStatements(owner)]
    : siblings;
}

/** The statements after `path` in its block. */
function nextSiblings(path: NodePath): readonly NodePath[] {
  return path.inList
    ? path
        .getAllNextSiblings()
        .flatMap((sibling) => (sibling.isStatement() ? [sibling] : []))
    : [];
}

/** `step(...)`, or `<context>.step(...)` on a play context that is not destructured. */
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

interface Check {
  /** The member names after `expect(...)`, such as `not` and `toHaveBeenCalled`. */
  readonly chain: readonly (string | undefined)[];
  /** The arguments of the matcher call at the end of the chain. */
  readonly args: readonly types.Node[];
}

/** The `expect(...)` checks in `path`. */
function checksIn(path: NodePath): readonly Check[] {
  const checks: Check[] = [];

  path.traverse({
    CallExpression(call) {
      if (nameOf(call.node.callee) === 'expect') {
        checks.push(checkOf(call));
      }
    },
  });

  return checks;
}

function checkOf(expectCall: NodePath): Check {
  const members = matcherChain(expectCall);
  const last = members.at(-1);
  const matcherCall = last?.parentPath?.node;

  return {
    chain: members.map((member) => nameOf(member.node.property)),
    args:
      matcherCall?.type === 'CallExpression' &&
      matcherCall.callee === last?.node
        ? matcherCall.arguments
        : [],
  };
}

function isNegative(check: Check): boolean {
  return check.chain.includes('not');
}

/** The member expressions after `expect(...)`, nearest first. */
function matcherChain(
  expectCall: NodePath,
): readonly NodePath<types.MemberExpression>[] {
  const member = expectCall.parentPath;

  return member?.isMemberExpression() && member.node.object === expectCall.node
    ? [member, ...matcherChain(member)]
    : [];
}

/** Whether `path` holds an `expect(...).toHaveBeenCalledTimes(0)` check. */
export function hasZeroCallsCheck(path: NodePath): boolean {
  return checksIn(path).some(
    ({ chain, args: [count] }) =>
      chain.at(-1) === 'toHaveBeenCalledTimes' &&
      count?.type === 'NumericLiteral' &&
      count.value === 0,
  );
}

const hooks: ReadonlySet<string> = new Set(['beforeEach', 'afterEach']);

/** A function that is the value of a `beforeEach` or `afterEach` property or an element of its array, or a method of that name. */
function isHook(path: NodePath): boolean {
  const { node } = path;

  if (node.type === 'ObjectMethod') {
    const name = nameOf(node.key);

    return name !== undefined && hooks.has(name);
  }

  const value =
    path.parentPath?.node.type === 'ArrayExpression' ? path.parentPath : path;
  const property = value.parent;

  if (!path.isFunction() || property?.type !== 'ObjectProperty') {
    return false;
  }

  const name = nameOf(property.key);

  return name !== undefined && hooks.has(name);
}

/** The expression inside `<x>!`, `<x> as T`, `<x> satisfies T`, `<T><x>` and parentheses. */
function withoutTypeWrappers(node: types.Node): types.Node {
  return node.type === 'TSNonNullExpression' ||
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'ParenthesizedExpression'
    ? withoutTypeWrappers(node.expression)
    : node;
}

/** The expression inside `await <x>` and any type wrappers around either. */
export function awaited(node: types.Node): types.Node {
  const expression = withoutTypeWrappers(node);

  return withoutTypeWrappers(
    expression.type === 'AwaitExpression' ? expression.argument : expression,
  );
}

function isInteractionCall(call: types.Node, path: NodePath): boolean {
  if (
    call.type !== 'CallExpression' &&
    call.type !== 'OptionalCallExpression'
  ) {
    return false;
  }

  const callee = withoutTypeWrappers(call.callee);

  if (
    callee.type !== 'MemberExpression' &&
    callee.type !== 'OptionalMemberExpression'
  ) {
    return (
      nameOf(callee) === 'fireEvent' ||
      (nameOf(callee) === 'step' && isStoryPlay(call.arguments[1]))
    );
  }

  const method = nameOf(callee.property);

  return (
    userEventMethod(call, path) !== undefined ||
    nameOf(callee.object) === 'fireEvent' ||
    (method !== undefined &&
      composedPlayMethods.has(method) &&
      callee.object.type === 'Identifier') ||
    (method !== undefined &&
      rawDomArguments.get(method) === call.arguments.length)
  );
}

// The Testing Library queries, by what they match.
export const queryKinds: readonly string[] = [
  'Role',
  'LabelText',
  'PlaceholderText',
  'Text',
  'DisplayValue',
  'AltText',
  'Title',
  'TestId',
];

/** The Testing Library query methods with one of the prefixes, such as `getBy` or `findAllBy`, and one of the kinds. */
export function queryMethods(
  prefixes: readonly string[],
  kinds: readonly string[] = queryKinds,
): readonly string[] {
  return prefixes.flatMap((prefix) => kinds.map((kind) => `${prefix}${kind}`));
}

/** The prefixes of the queries for one element. */
export const elementQueryPrefixes: readonly string[] = [
  'getBy',
  'findBy',
  'queryBy',
];

/** `<x>.getBy<Query>(...)`, `<x>.findBy<Query>(...)` or `<x>.queryBy<Query>(...)`: a Testing Library query for one element. */
export function isQueryCall(node: types.Node): boolean {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    elementQueries.includes(nameOf(node.callee.property) ?? '')
  );
}

const elementQueries = queryMethods(elementQueryPrefixes);

/** `<Story>.play`. */
function isStoryPlay(argument: types.Node | undefined): boolean {
  const node =
    argument === undefined ? undefined : withoutTypeWrappers(argument);

  return (
    node?.type === 'MemberExpression' &&
    node.object.type === 'Identifier' &&
    nameOf(node.property) === 'play'
  );
}

// The DOM element methods that interact, with their number of arguments.
const rawDomArguments: ReadonlyMap<string, number> = new Map([
  ['focus', 0],
  ['blur', 0],
  ['click', 0],
  ['dispatchEvent', 1],
]);

// `<Story>.play(context)`, and `<Story>.run()` on a CSF factory story.
const composedPlayMethods: ReadonlySet<string> = new Set(['play', 'run']);

// The user-event methods that act on the page: those of user-event 14 (@testing-library/user-event, which
// storybook/test re-exports) and those only Vitest browser's userEvent has.
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

/** `userEvent`, `<x>.userEvent` such as the play context's, a local given only `userEvent.setup()` or a choice between user-events, or Vitest browser's userEvent under another name. `seen` holds the bindings already followed, so a local given a choice of itself ends the search. */
function isUserEvent(
  node: types.Node,
  path: NodePath,
  seen: ReadonlySet<Binding> = new Set(),
): boolean {
  const name = nameOf(node);

  if (
    name === 'userEvent' ||
    (node.type === 'MemberExpression' && nameOf(node.property) === 'userEvent')
  ) {
    return true;
  }

  const binding = name === undefined ? undefined : path.scope.getBinding(name);

  if (name === undefined || (binding !== undefined && seen.has(binding))) {
    return false;
  }

  const value = boundValue(path, name);
  const followed = binding === undefined ? seen : new Set([...seen, binding]);

  return (
    isSetupCall(value, path, followed) ||
    isUserEventChoice(value, path, followed) ||
    isVitestBrowserUserEvent(path, name) ||
    isContextUserEvent(path, name)
  );
}

/** `({ userEvent: <name> }) => ...`: a context's userEvent destructured under another name in a parameter. */
function isContextUserEvent(path: NodePath, name: string): boolean {
  const binding = path.scope.getBinding(name);

  return (
    binding?.kind === 'param' &&
    binding.path.node.type === 'ObjectPattern' &&
    takesUserEventAs(binding.path.node, name)
  );
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

/** `<condition> ? <userEvent> : <userEvent>`, such as Vitest browser's userEvent in a Vitest run and Storybook's otherwise. */
function isUserEventChoice(
  node: types.Node | undefined,
  path: NodePath,
  seen: ReadonlySet<Binding>,
): boolean {
  return (
    node?.type === 'ConditionalExpression' &&
    isUserEvent(node.consequent, path, seen) &&
    isUserEvent(node.alternate, path, seen)
  );
}

/** `import { userEvent as <name> } from 'vitest/browser'` or `const { userEvent: <name> } = await import('vitest/browser')`. */
function isVitestBrowserUserEvent(path: NodePath, name: string): boolean {
  const binding = path.scope.getBinding(name);

  if (binding === undefined) {
    return false;
  }

  if (binding.path.isImportSpecifier()) {
    const declaration = binding.path.parent;

    return (
      nameOf(binding.path.node.imported) === 'userEvent' &&
      declaration.type === 'ImportDeclaration' &&
      vitestBrowserSources.has(declaration.source.value)
    );
  }

  if (!binding.path.isVariableDeclarator()) {
    return false;
  }

  const { id, init } = binding.path.node;

  return (
    id.type === 'ObjectPattern' &&
    takesUserEventAs(id, name) &&
    init !== null &&
    init !== undefined &&
    isVitestBrowserImport(awaited(init))
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

/** `<userEvent>.setup()`, on any user-event receiver. */
function isSetupCall(
  node: types.Node | undefined,
  path: NodePath,
  seen: ReadonlySet<Binding>,
): boolean {
  return (
    node?.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    nameOf(node.callee.property) === 'setup' &&
    isUserEvent(node.callee.object, path, seen)
  );
}

/** The one value a local `name` is ever given, by its declaration or a later assignment; none when something else, such as `++` or a `for...of` head, also changes it. */
function boundValue(path: NodePath, name: string): types.Node | undefined {
  const binding = path.scope.getBinding(name);

  if (binding === undefined || !binding.path.isVariableDeclarator()) {
    return undefined;
  }

  const assigned = binding.constantViolations.flatMap(({ node }) =>
    node.type === 'AssignmentExpression' ? [node.right] : [],
  );

  if (assigned.length < binding.constantViolations.length) {
    return undefined;
  }

  const values = [binding.path.node.init, ...assigned].filter(
    (value) => value !== null && value !== undefined,
  );

  return values.length === 1 ? values[0] : undefined;
}

/** The name of an object key, quoted or not. */
function keyName(key: types.Node): string | undefined {
  return key.type === 'StringLiteral' ? key.value : nameOf(key);
}

function nameOf(node: types.Node): string | undefined {
  return node.type === 'Identifier' ? node.name : undefined;
}
