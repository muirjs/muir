import type { NodePath, types } from '@babel/core';

import { hasCheck } from './checks.ts';
import {
  awaited,
  type Binding,
  bindingOf,
  nameOf,
  withoutTypeWrappers,
} from './nodes.ts';
import { isInStoryTestCode, readStoryFileAt } from './story-file.ts';
import { isUserEvent, userEventMethods } from './user-event.ts';

type CallNode = types.CallExpression | types.OptionalCallExpression;

/** Where an interaction stands: an expression statement, or the expression body of an arrow passed to `step(...)`. */
type InteractionSite =
  | { readonly site: 'statement'; readonly node: types.ExpressionStatement }
  | { readonly site: 'stepBody'; readonly node: types.Expression };

/** What an interaction's call is. A fireEvent call's `method` is its event when the call names it as `fireEvent.<event>`. */
type InteractionKind =
  | { readonly kind: 'userEvent'; readonly method: string }
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
    userEventMethods.has(method) &&
    isUserEvent(withoutTypeWrappers(member.object), path)
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

/** An interaction that makes no mutant: one in a `beforeEach` or `afterEach`. */
export function isSkipped({ path }: Interaction): boolean {
  return path.findParent(isHook) !== null;
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

/** The first statement after `path` in its block that holds one of its following checks. */
export function firstCheckAfter(path: NodePath): NodePath | undefined {
  return statementsBefore(nextSiblings(path), holdsInteraction).find(hasCheck);
}

/** Whether `statement` is an interaction or holds one that runs within it, such as an `if` around one; outside a step callback, only step and `waitFor` callbacks are looked into, while a `step(...)` holds every interaction in its callback, including one in a function the callback defines. */
function holdsInteraction(statement: NodePath): boolean {
  const { node } = statement;
  const isStep =
    node.type === 'ExpressionStatement' && isStepCall(awaited(node.expression));

  return (
    interactionAt(statement) !== undefined ||
    hasInteractionIn(statement, isStep ? () => true : runsWhereGiven)
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
