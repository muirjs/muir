import type { CsfShapes } from './csf.ts';
import { isCall, isMember, unwrap } from './csf-nodes.ts';
import {
  type FollowingChecks,
  followingChecksReader,
  isStepCall,
  type StatementRead,
  targetOf,
} from './following-checks.ts';
import { field, list } from './node-field.ts';
import {
  awaited,
  descendants,
  indexTree,
  isFunction,
  isNode,
  memberName,
  type TreeIndex,
} from './node-tree.ts';
import { type FileScope, fileScope, functionsOf } from './scope.ts';
import {
  type UserEventOrigin,
  userEventMethods,
  userEventOrigins,
} from './user-event-origin.ts';

export type { Check, FollowingChecks, WindowEnd } from './following-checks.ts';
export type { UserEventOrigin } from './user-event-origin.ts';

type Kind =
  | {
      readonly kind: 'userEvent';
      /** `undefined` for a computed key that is not a string literal. */
      readonly method: string | undefined;
      readonly origin: UserEventOrigin;
    }
  | { readonly kind: 'fireEvent'; readonly method: string | undefined }
  | { readonly kind: 'composedPlay' | 'rawDom'; readonly method: string };

export type Interaction = {
  /** The statement: an expression statement, or the expression body of an arrow. Its identity is the join key. */
  readonly node: unknown;
  /** The call, without `await`, optional chaining or type wrappers. */
  readonly call: unknown;
  readonly args: readonly unknown[];
  /** The first argument without `await` or type wrappers, or, for a name the file binds once by `const`, that const's init without `await`. */
  readonly targetValue: unknown;
  /** Stands in a `beforeEach` or `afterEach` function. */
  readonly inHook: boolean;
  readonly following: FollowingChecks;
} & Kind;

export interface StoryInteractions {
  /** Source order. */
  readonly all: readonly Interaction[];
  /** The interaction whose statement is `node`, by identity. */
  readonly at: (node: unknown) => Interaction | undefined;
  /** The interaction whose target query is the call nearest around `node`. */
  readonly aimedAt: (node: unknown) => Interaction | undefined;
}

const hooks: ReadonlySet<unknown> = new Set(['beforeEach', 'afterEach']);

/** The DOM element methods that interact, with their number of arguments. */
const rawDomArguments: ReadonlyMap<string, number> = new Map([
  ['focus', 0],
  ['blur', 0],
  ['click', 0],
  ['dispatchEvent', 1],
]);

/** `<Story>.play(context)`, and `<Story>.run()` on a CSF factory story. */
const composedPlayMethods: ReadonlySet<string> = new Set(['play', 'run']);

/** An identifier, or a member chain that starts at one, computed or optional members and type wrappers included, such as `Stories.Other`, `Stories['Other']` or `Stories?.Other`. */
function startsAtIdentifier(node: unknown): boolean {
  const inner = unwrap(node);

  return (
    field(inner, 'type') === 'Identifier' ||
    (isMember(inner) && startsAtIdentifier(field(inner, 'object')))
  );
}

/** `<Story>.play`, where `<Story>` starts at an identifier, such as `Other`, `Stories.Other` or `Stories?.Other`. */
function isStoryPlay(argument: unknown): boolean {
  const node = unwrap(argument);

  return (
    isMember(node) &&
    startsAtIdentifier(field(node, 'object')) &&
    memberName(node) === 'play'
  );
}

/** `node` when it is a call, else the nearest call around it. */
function callAround(tree: TreeIndex, node: unknown): unknown {
  return [node, ...tree.ancestors(node)].find(
    (each) => field(each, 'type') === 'CallExpression',
  );
}

/**
 * The `beforeEach` and `afterEach` functions of a file: a method of such a name, and the value of such a property or
 * each element of its array, under an identifier or a string key, computed or not. A value is a function, or a name that holds the
 * functions `functionsOf` gives. The property's value, the array and each element are read through parentheses,
 * casts and non-null assertions.
 */
function hooksOf(program: unknown, scope: FileScope): ReadonlySet<unknown> {
  return new Set(
    descendants(program).flatMap((node): readonly unknown[] => {
      if (
        !hooks.has(field(node, 'key', 'name') ?? field(node, 'key', 'value'))
      ) {
        return [];
      }

      if (field(node, 'type') === 'ObjectMethod') {
        return [node];
      }

      if (field(node, 'type') !== 'ObjectProperty') {
        return [];
      }

      const value = unwrap(field(node, 'value'));
      const values =
        field(value, 'type') === 'ArrayExpression'
          ? list(field(value, 'elements')).map(unwrap)
          : [value];

      return values.flatMap((each) =>
        isFunction(each) ? [each] : functionsOf(scope.bindingOf(each)),
      );
    }),
  );
}

/** Reads every interaction of one file, once, from its Program. Accepts Babel 7 and Babel 8 trees. `shapes` is `csfShapes(program)`. */
export function interactionsOf(
  program: unknown,
  shapes: CsfShapes,
): StoryInteractions {
  const tree = indexTree(program);
  const scope = fileScope(program);
  const isInTestCode = (node: unknown): boolean =>
    [node, ...tree.ancestors(node)].some((each) => shapes.testCode.has(each));
  const hookFunctions = hooksOf(program, scope);
  const isInHook = (node: unknown): boolean =>
    [node, ...tree.ancestors(node)].some((each) => hookFunctions.has(each));
  const isUnderComputedKey = (node: unknown): boolean =>
    field(node, 'computed') === true ||
    field(tree.parentOf(node), 'computed') === true;
  const originOf = userEventOrigins(
    program,
    tree,
    scope,
    new Set(
      [...shapes.testCode].filter(
        (node) => isNode(node) && !isUnderComputedKey(node),
      ),
    ),
  );
  const kindOf = (call: unknown): Kind | undefined => {
    if (!isCall(call)) {
      return undefined;
    }

    const callee = unwrap(field(call, 'callee'));
    const method = memberName(callee);
    const receiver = field(callee, 'object');
    const actsOnPage =
      method === undefined
        ? field(callee, 'computed') === true
        : userEventMethods.has(method);
    const origin = actsOnPage ? originOf(receiver) : undefined;

    if (origin !== undefined) {
      return { kind: 'userEvent', method, origin };
    }

    const fireEvent = isMember(callee) ? unwrap(receiver) : callee;

    if (field(fireEvent, 'name') === 'fireEvent') {
      return { kind: 'fireEvent', method };
    }

    if (isStepCall(call)) {
      return isStoryPlay(list(field(call, 'arguments'))[1])
        ? { kind: 'composedPlay', method: 'step' }
        : undefined;
    }

    if (method === undefined || !isInTestCode(call)) {
      return undefined;
    }

    if (composedPlayMethods.has(method)) {
      return startsAtIdentifier(receiver)
        ? { kind: 'composedPlay', method }
        : undefined;
    }

    return rawDomArguments.get(method) === list(field(call, 'arguments')).length
      ? { kind: 'rawDom', method }
      : undefined;
  };
  /** `node`, or, for a name the file binds once by `const`, that const's init without `await`. */
  const valueOf = (node: unknown): unknown => {
    const binding = scope.bindingOf(node);
    const declaration = binding?.declaration;

    return binding?.kind === 'const' &&
      field(declaration, 'id') === binding.identifier
      ? awaited(field(declaration, 'init'))
      : node;
  };
  /** The expression `node` stands for as a statement: an expression statement's expression, or `node` itself when it is its parent's `body`, which among expressions only an arrow's expression body is; `undefined` otherwise. */
  const statementExpressionOf = (node: unknown): unknown =>
    field(node, 'type') === 'ExpressionStatement'
      ? field(node, 'expression')
      : field(tree.parentOf(node), 'body') === node
        ? node
        : undefined;
  const found = descendants(program).flatMap((node) => {
    const call = awaited(statementExpressionOf(node));
    const kind = kindOf(call);
    const args = list(field(call, 'arguments'));

    return kind === undefined
      ? []
      : [
          {
            read: {
              node,
              call,
              args,
              targetValue: valueOf(targetOf({ node, args })),
              inHook: isInHook(node),
            },
            kind,
          },
        ];
  });
  const reads: ReadonlyMap<unknown, StatementRead> = new Map(
    found.map(({ read }) => [read.node, read]),
  );
  const followingChecksOf = followingChecksReader(tree, scope, (node) =>
    reads.get(node),
  );
  const all: readonly Interaction[] = found.map(({ read, kind }) => ({
    ...read,
    ...kind,
    following: followingChecksOf(read),
  }));
  const byNode: ReadonlyMap<unknown, Interaction> = new Map(
    all.map((interaction) => [interaction.node, interaction]),
  );

  return {
    all,
    at: (node) => byNode.get(node),
    aimedAt: (node) => {
      const query = callAround(tree, tree.parentOf(node));

      return query === undefined
        ? undefined
        : all.find((interaction) => targetOf(interaction) === query);
    },
  };
}
