import type { NodePath, types } from '@babel/core';

import { checksIn, hasCheck, isNegative } from './checks.ts';
import type { BabelTypes } from './mutator.ts';
import {
  awaited,
  type Binding,
  bindingOf,
  keyName,
  nameOf,
  withoutTypeWrappers,
} from './nodes.ts';
import { isInStoryTestCode, readStoryFileAt } from './story-file.ts';
import {
  changesUserEvent,
  readUserEvent,
  userEventMethods,
} from './user-event.ts';

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
      /** Whether the file proves the receiver is user-event 14, whose `type` clicks first; Vitest browser's does not. */
      readonly isProvenUserEvent14: boolean;
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
  readStoryFileAt(path, changesUserEvent);

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

    if (receiver !== 'none') {
      return {
        kind: 'userEvent',
        method,
        isProvenUserEvent14: receiver === 'provenUserEvent14',
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
    ? startsAtIdentifier(callee.object)
    : rawDomArguments.get(name) === call.arguments.length;

  return matches && isInStoryTestCode(path)
    ? { kind: isComposedPlay ? 'composedPlay' : 'rawDom' }
    : undefined;
}

/** An identifier, or a member chain that starts at one, computed or optional members included, such as `Stories.Other`, `Stories['Other']` or `Stories?.Other`. */
function startsAtIdentifier(node: types.Node): boolean {
  return (
    node.type === 'Identifier' ||
    (isMember(node) && startsAtIdentifier(node.object))
  );
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

/** An interaction that makes no mutant: one in a story hook, one with following checks whose checks before the next interaction are all negative, a click that a type of its target repeats, or a type that a later clear undoes. */
export function isSkipped(interaction: Interaction, t: BabelTypes): boolean {
  const { path } = interaction;

  return (
    path.findParent(isHook) !== null ||
    hasOnlyNegativeChecks(path) ||
    isRepeatedByNext(interaction, t) ||
    isClearedLater(interaction, t)
  );
}

/** A user-event type or clear with no following checks, when the statement that ends them is a user-event clear of the same target. */
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
  const between = statementsBefore(siblings, holdsInteraction);
  const next = siblings[between.length];
  const later =
    next === undefined || between.some(hasCheck)
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

/** A user-event click or hover directly before a type of the same target on a receiver the file proves to be user-event 14, which clicks it first; Vitest browser's type does not. */
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
    following.isProvenUserEvent14 &&
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
  readStoryFileAt(path, changesUserEvent);

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

/** The first statement after `path` in its block that holds one of its following checks. */
export function firstCheckAfter(path: NodePath): NodePath | undefined {
  return statementsBefore(nextSiblings(path), holdsInteraction).find(hasCheck);
}

/** Whether `path` has a following check and its checks before the next interaction are all negative, both looked for past the end of its block and of a step callback that holds it. */
function hasOnlyNegativeChecks(path: NodePath): boolean {
  const later = laterStatements(path);

  return (
    statementsBefore(later, holdsInteraction).some(hasCheck) &&
    statementsBefore(later, isNextInteraction)
      .flatMap(checksIn)
      .every(isNegative)
  );
}

/** Whether `statement` ends the checks before the next interaction: it is an interaction, or a `step(...)` whose callback holds one. */
function isNextInteraction(statement: NodePath): boolean {
  const { node } = statement;

  return (
    interactionAt(statement) !== undefined ||
    (node.type === 'ExpressionStatement' &&
      isStepCall(awaited(node.expression)) &&
      hasInteractionIn(statement, () => true))
  );
}

/** Whether `statement` is an interaction or holds one that runs within it, such as an `if` around one; outside a step callback, only step and `waitFor` callbacks are looked into, while a `step(...)` holds every interaction in its callback, including one in a function the callback defines. */
function holdsInteraction(statement: NodePath): boolean {
  return (
    isNextInteraction(statement) || hasInteractionIn(statement, runsWhereGiven)
  );
}

/** Whether an interaction stands inside `path`, looking into a function, `path` itself included, only when `entersFunction` holds for it. */
function hasInteractionIn(
  path: NodePath,
  entersFunction: (fn: NodePath) => boolean,
): boolean {
  if (path.isFunction() && !entersFunction(path)) {
    return false;
  }

  let found = false;

  path.traverse({
    enter(inner) {
      if (inner.isFunction() && !entersFunction(inner)) {
        inner.skip();
      } else if (interactionAt(inner) !== undefined) {
        found = true;
        inner.stop();
      }
    },
  });

  return found;
}

/** A function given to `step(...)` or `waitFor(...)`, which calls it. */
function runsWhereGiven(fn: NodePath): boolean {
  const owner = fn.parentPath?.node;

  return (
    owner?.type === 'CallExpression' &&
    (isStepCall(owner) || nameOf(owner.callee) === 'waitFor')
  );
}

/** The statements before the first one among them that `ends`. */
function statementsBefore(
  statements: readonly NodePath[],
  ends: (statement: NodePath) => boolean,
): readonly NodePath[] {
  const end = statements.findIndex(ends);

  return end === -1 ? statements : statements.slice(0, end);
}

/** The statements that run after `path` in its function, and after the step call when that function is a step callback. */
function laterStatements(path: NodePath): readonly NodePath[] {
  const siblings = nextSiblings(path);
  const parent = path.parentPath;

  if (parent === null) {
    return siblings;
  }

  if (!parent.isFunction()) {
    return [...siblings, ...laterStatements(parent)];
  }

  const owner = parent.parentPath;

  return owner !== null && isStepCall(owner.node)
    ? [...siblings, ...laterStatements(owner)]
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

  return id === null || id === undefined || parentPath === null
    ? undefined
    : bindingOf(id, parentPath.scope);
}

/** `<Story>.play`, where `<Story>` starts at an identifier, such as `Other`, `Stories.Other` or `Stories?.Other`. */
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

// The DOM element methods that interact, with their number of arguments.
const rawDomArguments: ReadonlyMap<string, number> = new Map([
  ['focus', 0],
  ['blur', 0],
  ['click', 0],
  ['dispatchEvent', 1],
]);

// `<Story>.play(context)`, and `<Story>.run()` on a CSF factory story.
const composedPlayMethods: ReadonlySet<string> = new Set(['play', 'run']);
