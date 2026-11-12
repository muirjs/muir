import type { NodePath, types } from '@babel/core';

import {
  type Binding,
  bindingOf,
  keyName,
  memberName,
  nameOf,
} from './nodes.ts';
import {
  isChoiceSide,
  isMemberObject,
  isMethodCallReceiver,
  isOnlyCalledOn,
} from './only-called-on.ts';
import { isInStoryTestCode, perFile } from './story-file.ts';

/** A play's context parameter, not destructured, that holds what Storybook set. */
export function isPlayContext(node: types.Node, path: NodePath): boolean {
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

/** The first parameter of a play that Storybook calls: a `play` method, or a function given as a `play` property, under a key that is not computed, which is story test code and inside none. */
export function isPlayParameter(binding: Binding): boolean {
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
export function isContextLeftAsSet(binding: Binding): boolean {
  return (
    binding.constantViolations.length === 0 &&
    contextsOnlyRead(binding.path) &&
    namesOnlyReadUserEvent(binding.path)
  );
}

/** Whether the file names userEvent only where the rules read it: an import's name, a key or local in a parameter's destructuring, or a `userEvent` or `<x>.userEvent` only called on; never as a string or a template's text. It backs up `contextsOnlyRead`, which reads only the hooks it knows. */
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
