import type { NodePath, types } from '@babel/core';
import { csfShapes } from '@layzee/storybook-csf';

import type { BabelTypes } from './mutator.ts';

type Binding = NonNullable<ReturnType<NodePath['scope']['getBinding']>>;

type CallNode = types.CallExpression | types.OptionalCallExpression;

/** Where an interaction stands: an expression statement, or the expression body of an arrow passed to `step(...)`. */
type InteractionSite =
  | { readonly site: 'statement'; readonly node: types.ExpressionStatement }
  | { readonly site: 'stepBody'; readonly node: types.Expression };

/** What an interaction's call is. A fireEvent call's `method` is its event when the call names it as `fireEvent.<event>`. */
type InteractionKind =
  | {
      readonly kind: 'userEvent';
      readonly method: string;
      /** Whether the receiver is or may be Vitest browser's userEvent, whose `type` does not click first. */
      readonly mayBeVitestBrowser: boolean;
    }
  | { readonly kind: 'fireEvent'; readonly method: string | undefined }
  | { readonly kind: 'composedPlay' | 'rawDom' };

export type Interaction = InteractionSite &
  InteractionKind & {
    readonly path: NodePath;
    /** The call, without `await`, optional chaining or type wrappers around it. */
    readonly call: CallNode;
  };

/** The interaction at `path`, when `path` is an interaction site whose call is an interaction. */
export function interactionAt(path: NodePath): Interaction | undefined {
  readStoryFileAt(path);

  const site = siteAt(path);

  if (site === undefined) {
    return undefined;
  }

  const call = awaited(
    site.site === 'statement' ? site.node.expression : site.node,
  );

  if (
    call.type !== 'CallExpression' &&
    call.type !== 'OptionalCallExpression'
  ) {
    return undefined;
  }

  const kind = kindOf(call, path);

  return kind === undefined ? undefined : { ...site, ...kind, path, call };
}

function siteAt(path: NodePath): InteractionSite | undefined {
  if (path.isExpressionStatement()) {
    return { site: 'statement', node: path.node };
  }

  return isStepBody(path) ? { site: 'stepBody', node: path.node } : undefined;
}

function kindOf(call: CallNode, path: NodePath): InteractionKind | undefined {
  const member = isMember(call.callee) ? call.callee : undefined;
  const method = member === undefined ? undefined : nameOf(member.property);

  if (
    member !== undefined &&
    method !== undefined &&
    userEventMethods.has(method)
  ) {
    const receiver = readUserEvent(withoutTypeWrappers(member.object), path);

    if (receiver.isUserEvent) {
      return {
        kind: 'userEvent',
        method,
        mayBeVitestBrowser: receiver.mayBeVitestBrowser,
      };
    }
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
    ? callee.object.type === 'Identifier'
    : rawDomArguments.get(name) === call.arguments.length;

  return matches && isInStoryTestCode(path)
    ? { kind: isComposedPlay ? 'composedPlay' : 'rawDom' }
    : undefined;
}

function isMember(
  node: types.Node,
): node is types.MemberExpression | types.OptionalMemberExpression {
  return (
    node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression'
  );
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

/** An interaction that makes no mutant: one in a story hook, one whose following checks are all negative, a click that a type of its target repeats, or a type that a later clear undoes. */
export function isSkipped(interaction: Interaction, t: BabelTypes): boolean {
  const { path } = interaction;

  return (
    path.findParent(isHook) !== null ||
    hasOnlyNegativeChecks(path) ||
    isRepeatedByNext(interaction, t) ||
    isClearedLater(interaction, t)
  );
}

/** A user-event type or clear that the next interaction, a user-event clear of the same target, undoes with no check between. */
function isClearedLater(current: Interaction, t: BabelTypes): boolean {
  const [target] = current.call.arguments;

  if (
    current.kind !== 'userEvent' ||
    target === undefined ||
    !['type', 'clear'].includes(current.method)
  ) {
    return false;
  }

  const siblings = nextSiblings(current.path);
  const between = untilNextInteraction(siblings);
  const next = siblings[between.length];
  const later =
    next === undefined ||
    between.some((sibling) => checksIn(sibling).length > 0)
      ? undefined
      : interactionAt(next);
  const [laterTarget] = later?.call.arguments ?? [];

  return (
    later?.kind === 'userEvent' &&
    later.method === 'clear' &&
    laterTarget !== undefined &&
    t.isNodesEquivalent(target, laterTarget)
  );
}

/** A user-event click or hover directly before a user-event 14 type of the same target, which clicks it first; Vitest browser's type does not. */
function isRepeatedByNext(current: Interaction, t: BabelTypes): boolean {
  const [next] = nextSiblings(current.path);
  const following = next === undefined ? undefined : interactionAt(next);
  const [target] = current.call.arguments;
  const [followingTarget, , options] = following?.call.arguments ?? [];

  return (
    current.kind === 'userEvent' &&
    following?.kind === 'userEvent' &&
    target !== undefined &&
    followingTarget !== undefined &&
    ['click', 'hover'].includes(current.method) &&
    following.method === 'type' &&
    !following.mayBeVitestBrowser &&
    !hasSkipClick(options) &&
    t.isNodesEquivalent(target, followingTarget)
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

/** The interaction whose first argument is the call nearest around `path`, such as the query in `userEvent.click(canvas.getByRole('button', { name: 'Save' }))` around `'Save'`. */
export function targetInteraction(path: NodePath): Interaction | undefined {
  readStoryFileAt(path);

  const query = path.findParent((parent) => parent.isCallExpression());
  const site = path.findParent(
    (parent) => parent.isStatement() || isStepBody(parent),
  );
  const interaction = site === null ? undefined : interactionAt(site);
  const [argument] = interaction?.call.arguments ?? [];

  return argument !== undefined && awaited(argument) === query?.node
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
      if (interactionAt(inner) !== undefined) {
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
      interactionAt(statement) !== undefined ||
      isStepWithInteraction(statement),
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

function isHook(path: NodePath): boolean {
  return isPropertyFunction(path, hooks);
}

const testCodeByProgram = new WeakMap<object, ReadonlySet<unknown>>();

/** The story test code of the file around `path`, as `csfShapes` reads it the first time it is asked. */
function storyTestCode(path: NodePath): ReadonlySet<unknown> {
  const program = path.isProgram()
    ? path
    : path.findParent((parent) => parent.isProgram());

  if (program === null) {
    return new Set();
  }

  const read = testCodeByProgram.get(program.node);

  if (read !== undefined) {
    return read;
  }

  const { testCode } = csfShapes(program.node);

  testCodeByProgram.set(program.node, testCode);

  return testCode;
}

/** Reads the file's story test code at its program: Stryker places a statement's mutants when it leaves the statement, so a later read could find a story replaced by a mutant switch. */
function readStoryFileAt(path: NodePath): void {
  if (path.isProgram()) {
    storyTestCode(path);
  }
}

function isInStoryTestCode(path: NodePath): boolean {
  const testCode = storyTestCode(path);

  return path.findParent((parent) => testCode.has(parent.node)) !== null;
}

/** A function that is the value of a property named in `names` or an element of its array, a method of such a name, or a function declared in the file and given there by its name. */
function isPropertyFunction(
  path: NodePath,
  names: ReadonlySet<string>,
): boolean {
  const { node } = path;

  if (node.type === 'ObjectMethod') {
    const name = nameOf(node.key);

    return name !== undefined && names.has(name);
  }

  if (!path.isFunction()) {
    return false;
  }

  const binding = functionBinding(path);

  return (
    isPropertyValue(path, names) ||
    (binding?.referencePaths ?? []).some((reference) =>
      isPropertyValue(reference, names),
    )
  );
}

/** A value of a property named in `names`, or an element of its array. */
function isPropertyValue(path: NodePath, names: ReadonlySet<string>): boolean {
  const value =
    path.parentPath?.node.type === 'ArrayExpression' ? path.parentPath : path;
  const property = value.parent;

  if (property?.type !== 'ObjectProperty') {
    return false;
  }

  const name = nameOf(property.key);

  return name !== undefined && names.has(name);
}

/** The binding of `function <name>() {}` or of `const <name> = <function>`. */
function functionBinding(path: NodePath): Binding | undefined {
  const { node, parent, parentPath } = path;
  const id =
    node.type === 'FunctionDeclaration'
      ? node.id
      : parent?.type === 'VariableDeclarator' && parent.init === node
        ? parent.id
        : undefined;
  const name = id === null || id === undefined ? undefined : nameOf(id);

  return name === undefined ? undefined : parentPath?.scope.getBinding(name);
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

interface UserEventReading {
  readonly isUserEvent: boolean;
  readonly mayBeVitestBrowser: boolean;
}

const noUserEvent: UserEventReading = {
  isUserEvent: false,
  mayBeVitestBrowser: false,
};

/** Reads `userEvent`, `<x>.userEvent` such as the play context's, or a local that `userEventBinding` reads as a user-event. `seen` holds the bindings already followed, so a local given a choice of itself ends the search. */
function readUserEvent(
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

/** The name of an object key, quoted or not. */
function keyName(key: types.Node): string | undefined {
  return key.type === 'StringLiteral' ? key.value : nameOf(key);
}

function nameOf(node: types.Node): string | undefined {
  return node.type === 'Identifier' ? node.name : undefined;
}
