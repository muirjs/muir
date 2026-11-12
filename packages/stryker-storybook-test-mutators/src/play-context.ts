import type { NodePath, types } from '@babel/core';

import {
  type Binding,
  bindingOf,
  isInType,
  keyName,
  memberName,
  nameOf,
  outsideTypeWrappers,
  withoutTypeWrappers,
} from './nodes.ts';
import {
  isChoiceSide,
  isMemberObject,
  isMethodCallReceiver,
  isOnlyCalledOn,
} from './only-called-on.ts';
import { isInStoryTestCode, isMetaOrStory, perFile } from './story-file.ts';

/** A play's context parameter, not destructured, that holds what Storybook set. */
export function isPlayContext(node: types.Node, path: NodePath): boolean {
  const binding = bindingOf(node, path.scope);

  return (
    binding !== undefined &&
    binding.path.isIdentifier() &&
    isPlayContextAsSet(binding)
  );
}

/** A play's context parameter, or a local it destructures, that holds what Storybook set. */
export function isPlayContextAsSet(binding: Binding): boolean {
  return (
    binding.kind === 'param' &&
    isPlayParameter(binding) &&
    isContextLeftAsSet(binding)
  );
}

/** `<context>.<name>`, or a declaration's value whose local or pattern is read as a context. A `context` member, which Storybook sets to the context itself, is read the same way, a `step` member may only be called, and a `userEvent` member only called on, as the binding rule asks of a local. */
function isContextRead(path: NodePath, reads: FileReads): boolean {
  const { parentPath } = path;

  if (parentPath?.isVariableDeclarator() && path.key === 'init') {
    return isContextLocal(parentPath.node.id, parentPath.scope, reads);
  }

  if (!isMemberObject(path) || parentPath === null) {
    return false;
  }

  const name = memberName(parentPath.node);

  if (name === 'context') {
    return isContextRead(parentPath, reads);
  }

  if (name === 'step') {
    return isStepRead(parentPath, reads);
  }

  return (
    name !== 'userEvent' ||
    isMethodCallReceiver(parentPath) ||
    isChoiceSide(parentPath)
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
    binding.constantViolations.length === 0 &&
    contextsOnlyRead(binding.path) &&
    namesOnlyReadUserEvent(binding.path)
  );
}

/** Whether the file names userEvent only where the rules read it: an import's name, a key or local in a parameter's destructuring, a `userEvent` or `<x>.userEvent` only called on, or inside a type; never as a string or a template's text. It backs up `contextsOnlyRead`, which reads only the hooks it knows. */
export const namesOnlyReadUserEvent = perFile((program) => {
  let onlyRead = true;

  const check = (path: NodePath, read: boolean): void => {
    if (!read) {
      onlyRead = false;
      path.stop();
    }
  };

  program.traverse({
    Identifier(path) {
      check(path, path.node.name !== 'userEvent' || readsUserEvent(path));
    },
    StringLiteral(path) {
      check(path, path.node.value !== 'userEvent');
    },
    TemplateElement(path) {
      check(path, path.node.value.cooked !== 'userEvent');
    },
  });

  return onlyRead;
}, false);

function readsUserEvent(path: NodePath<types.Identifier>): boolean {
  const { parentPath } = path;

  if (parentPath === null) {
    return false;
  }

  if (
    isInType(path) ||
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
      : path;

  return isMethodCallReceiver(read) || isChoiceSide(read);
}

/** Whether every context the file can reach is only read: as `<context>.<name>` or destructured under plain keys, in hooks whose code the file holds. A context's userEvent is held to the binding rule (`isOnlyCalledOn`), as a hook that changes that object changes the play's. */
export const contextsOnlyRead = perFile((program) => {
  let onlyRead = true;
  const reads: FileReads = {
    reachedLocals: new Set(),
    argumentReaders: new Map(),
  };

  const check = (path: NodePath, read: boolean): void => {
    if (!read) {
      onlyRead = false;
      path.stop();
    }
  };

  program.traverse({
    AssignmentExpression(path) {
      const left = withoutTypeWrappers(path.node.left);

      check(
        path,
        left.type !== 'MemberExpression' ||
          isKeyedHookRead(
            left.property,
            left.computed,
            path.get('right'),
            reads,
          ),
      );
    },
    CallExpression(path) {
      const name = calleeName(path.node.callee, path.scope);

      check(path, name !== 'useStoryContext' || isContextRead(path, reads));
      check(
        path,
        name !== 'assign' ||
          path.node.arguments.every((argument) =>
            isHeldObject(argument, path.scope),
          ),
      );
    },
    MemberExpression(path) {
      check(
        path,
        !isPatternOrLoopTarget(outsideTypeWrappers(path)) ||
          hookPositions(path.node.property, path.node.computed).length === 0,
      );
    },
    ObjectMethod(path) {
      check(
        path,
        hookPositions(path.node.key, path.node.computed).every(
          (position) =>
            path.node.kind === 'method' &&
            isContextParameterRead(path, position, reads),
        ),
      );
    },
    ObjectProperty(path) {
      check(
        path,
        path.parentPath.isObjectPattern() ||
          isKeyedHookRead(
            path.node.key,
            path.node.computed,
            path.get('value'),
            reads,
          ),
      );
    },
    SpreadElement(path) {
      check(
        path,
        !isMetaOrStory(path.parentPath) ||
          isHeldObject(path.node.argument, path.scope),
      );
    },
  });

  return onlyRead;
}, false);

/** A member a destructuring or a loop writes to: a pattern's element, rest, default's target or property value, or a `for...of` or `for...in` target. */
function isPatternOrLoopTarget(member: NodePath): boolean {
  const { parentPath } = member;

  return (
    parentPath !== null &&
    (parentPath.isArrayPattern() ||
      (parentPath.isForXStatement() && member.key === 'left') ||
      parentPath.isRestElement() ||
      (parentPath.isAssignmentPattern() && member.key === 'left') ||
      (parentPath.isObjectProperty() &&
        member.key === 'value' &&
        parentPath.parentPath.isObjectPattern()))
  );
}

/** An object literal with no spread of its own, or a local the file never reassigns whose value is one, so the file holds every hook it gives. */
function isHeldObject(argument: types.Node, scope: NodePath['scope']): boolean {
  if (argument.type === 'ObjectExpression') {
    return spreadsNothing(argument);
  }

  const binding = bindingOf(argument, scope);
  const declaration = binding?.path.node;

  return (
    binding?.constantViolations.length === 0 &&
    declaration?.type === 'VariableDeclarator' &&
    declaration.init?.type === 'ObjectExpression' &&
    spreadsNothing(declaration.init)
  );
}

function spreadsNothing(object: types.ObjectExpression): boolean {
  return object.properties.every(
    (property) => property.type !== 'SpreadElement',
  );
}

/** The name a call's callee goes by: a member's property, or an identifier's name, or the name it is imported under. */
function calleeName(
  callee: types.Node,
  scope: NodePath['scope'],
): string | undefined {
  if (callee.type === 'MemberExpression' && !callee.computed) {
    return nameOf(callee.property);
  }

  const declaration = bindingOf(callee, scope)?.path;

  return declaration?.isImportSpecifier()
    ? keyName(declaration.node.imported)
    : nameOf(callee);
}

/** A value given under a key, as an object's property or an assignment to a member, read as the hook that key may name. */
function isKeyedHookRead(
  key: types.Node,
  computed: boolean,
  value: NodePath,
  reads: FileReads,
): boolean {
  return hookPositions(key, computed).every((position) =>
    isHookValueRead(value, position, reads),
  );
}

/** A hook value, or an array of them, whose every function the file holds and reads its context in. */
function isHookValueRead(
  value: NodePath,
  position: number,
  reads: FileReads,
): boolean {
  const hooks = value.isArrayExpression() ? value.get('elements') : [value];

  return hooks.every((hook) => {
    const fn = hookFunction(hook);

    return fn !== undefined && isContextParameterRead(fn, position, reads);
  });
}

/** The function a hook value is: given inline, or by the name of a local function, or a function expression's own name, that the file never reassigns. */
function hookFunction(
  hook: NodePath<types.Node | null>,
): NodePath<types.Function> | undefined {
  if (hook.isFunction()) {
    return hook;
  }

  const binding =
    hook.node === null ? undefined : bindingOf(hook.node, hook.scope);
  const declaration = binding?.path;

  if (binding?.constantViolations.length !== 0) {
    return undefined;
  }

  if (
    declaration?.isFunctionDeclaration() ||
    declaration?.isFunctionExpression()
  ) {
    return declaration;
  }

  const init = declaration?.isVariableDeclarator()
    ? declaration.get('init')
    : undefined;

  return init?.isFunction() ? init : undefined;
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

/** Whether a hook reads the context it takes at `position`. */
function isContextParameterRead(
  hook: NodePath<types.Function>,
  position: number,
  reads: FileReads,
): boolean {
  if (readsArguments(hook, reads)) {
    return false;
  }

  const parameter = hook.node.params[position];

  if (parameter !== undefined) {
    return isContextLocal(parameter, hook.scope, reads);
  }

  return !hook.node.params.some((earlier) => earlier.type === 'RestElement');
}

/** Whether a hook reads `arguments`, walked once per hook in a file's read. */
function readsArguments(
  hook: NodePath<types.Function>,
  reads: FileReads,
): boolean {
  const known = reads.argumentReaders.get(hook.node);

  if (known !== undefined) {
    return known;
  }

  let found = false;

  hook.traverse({
    Identifier(path) {
      if (path.node.name === 'arguments' && path.isReferencedIdentifier()) {
        found = true;
        path.stop();
      }
    },
  });
  reads.argumentReaders.set(hook.node, found);

  return found;
}

/** A destructuring of a context under plain keys, whose `userEvent` local is only called on. */
function isReadPattern(
  pattern: types.ObjectPattern,
  scope: NodePath['scope'],
  reads: FileReads,
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
      const binding = bindingOf(local, scope);

      return binding !== undefined && isOnlyCalledOn(binding);
    }

    if (name === 'step') {
      return isStepLocal(local, scope, reads);
    }

    return name !== 'context' || isContextLocal(local, scope, reads);
  });
}

/** A context's `step` member, called or given to a local by a declaration. */
function isStepRead(step: NodePath, reads: FileReads): boolean {
  const { parentPath } = step;

  if (parentPath?.isVariableDeclarator() && step.key === 'init') {
    return isStepLocal(parentPath.node.id, parentPath.scope, reads);
  }

  return isStepCall(step, reads);
}

/** A local that a context's `step` is given to, only called with a callback read as a hook taking the context first. */
function isStepLocal(
  local: types.Node,
  scope: NodePath['scope'],
  reads: FileReads,
): boolean {
  const binding = bindingOf(local, scope);

  return (
    binding !== undefined &&
    binding.referencePaths.every((reference) => isStepCall(reference, reads))
  );
}

/** `<step>(<name>, <callback>)`, whose callback Storybook runs with the context, with no spread argument that could hold one. */
function isStepCall(step: NodePath, reads: FileReads): boolean {
  const call = step.parentPath;

  if (!call?.isCallExpression() || step.key !== 'callee') {
    return false;
  }

  const stepArguments = call.get('arguments');
  const [, callback] = stepArguments;

  return (
    !stepArguments.some((argument) => argument.isSpreadElement()) &&
    (callback === undefined || isHookValueRead(callback, 0, reads))
  );
}

/** What one file's read has found so far, kept only for that read, which stops at the first context not read. So a context local already reached counts as read: had its read found otherwise, nothing would be read after it. */
interface FileReads {
  readonly reachedLocals: Set<types.Node>;
  readonly argumentReaders: Map<types.Node, boolean>;
}

/** A local or pattern that a context is given to, read as a context, once per local or pattern. One reached again, itself included, counts as read, as reading it again finds nothing the first read does not. */
function isContextLocal(
  local: types.Node,
  scope: NodePath['scope'],
  reads: FileReads,
): boolean {
  if (reads.reachedLocals.has(local)) {
    return true;
  }

  reads.reachedLocals.add(local);

  return readsAsContext(local, scope, reads);
}

function readsAsContext(
  local: types.Node,
  scope: NodePath['scope'],
  reads: FileReads,
): boolean {
  if (local.type === 'ObjectPattern') {
    return isReadPattern(local, scope, reads);
  }

  const binding = bindingOf(local, scope);

  return (
    binding !== undefined &&
    binding.referencePaths.every((reference) => isContextRead(reference, reads))
  );
}
