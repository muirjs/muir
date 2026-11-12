import type { NodePath, types } from '@babel/core';

import { checksIn, isNegative } from './checks.ts';
import type { BabelTypes } from './mutator.ts';
import {
  awaited,
  type Binding,
  keyName,
  nameOf,
  withoutTypeWrappers,
} from './nodes.ts';
import { isInStoryTestCode, readStoryFileAt } from './story-file.ts';
import { readUserEvent, userEventMethods } from './user-event.ts';

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

/** The first statement after `path` in its block that holds an `expect(...)` check, before the next statement that is or holds an interaction. */
export function firstCheckAfter(path: NodePath): NodePath | undefined {
  return untilNextInteraction(nextSiblings(path)).find(
    (sibling) => checksIn(sibling).length > 0,
  );
}

/** The statements after `path`, up to the next statement that is or holds an interaction, hold an `expect(...)` check, and each one has `.not` in its matcher chain. */
function hasOnlyNegativeChecks(path: NodePath): boolean {
  const checks = untilNextInteraction(followingStatements(path)).flatMap(
    checksIn,
  );

  return checks.length > 0 && checks.every(isNegative);
}

/** Whether `statement` is an interaction or holds one, such as a `step(...)` or an `if` around one. */
function holdsInteraction(statement: NodePath): boolean {
  if (interactionAt(statement) !== undefined) {
    return true;
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

/** The statements before the first one among them that is or holds an interaction. */
function untilNextInteraction(
  statements: readonly NodePath[],
): readonly NodePath[] {
  const end = statements.findIndex(holdsInteraction);

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

const hooks: ReadonlySet<string> = new Set(['beforeEach', 'afterEach']);

function isHook(path: NodePath): boolean {
  return isPropertyFunction(path, hooks);
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
