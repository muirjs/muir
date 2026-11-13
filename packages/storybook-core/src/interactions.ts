import type { CsfShapes } from './csf.ts';
import { isMember, unwrap } from './csf-nodes.ts';
import {
  type FollowingChecks,
  followingChecksReader,
  isStepCall,
  type SiteRead,
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
import { type Binding, type FileScope, fileScope } from './scope.ts';
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
  readonly site: 'statement' | 'stepBody';
  /** The site: an expression statement, or the expression body of an arrow given to `step(...)`. Its identity is the join key. */
  readonly node: unknown;
  /** The call, without `await`, optional chaining or type wrappers. */
  readonly call: unknown;
  readonly args: readonly unknown[];
  /** The first argument without `await` or type wrappers, or, for a name the file binds once by `const`, that const's init without `await`. */
  readonly targetValue: unknown;
  /** Stands in a `beforeEach` or `afterEach` function: the test mutators' site rule. */
  readonly inHook: boolean;
  readonly following: FollowingChecks;
} & Kind;

export interface StoryInteractions {
  /** Source order. */
  readonly all: readonly Interaction[];
  /** The interaction whose site is `node`, by identity. */
  readonly at: (node: unknown) => Interaction | undefined;
  /** The interaction whose target query is the call nearest around `node`. */
  readonly aimedAt: (node: unknown) => Interaction | undefined;
}

const hooks: ReadonlySet<unknown> = new Set(['beforeEach', 'afterEach']);

const callTypes: readonly unknown[] = [
  'CallExpression',
  'OptionalCallExpression',
];

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
  if (!isNode(node)) {
    return undefined;
  }

  return field(node, 'type') === 'CallExpression'
    ? node
    : callAround(tree, tree.parentOf(node));
}

/** The `beforeEach` and `afterEach` functions of a file: a method of such a name, a function that is the value of such a property or an element of its array, and a function declared in the file and given there by its name. */
function hooksOf(
  program: unknown,
  tree: TreeIndex,
  scope: FileScope,
): ReadonlySet<unknown> {
  const isHookValue = (node: unknown): boolean => {
    const parent = tree.parentOf(node);
    const value = field(parent, 'type') === 'ArrayExpression' ? parent : node;
    const property = tree.parentOf(value);

    return (
      field(property, 'type') === 'ObjectProperty' &&
      field(property, 'value') === value &&
      hooks.has(field(property, 'key', 'name'))
    );
  };

  return new Set(
    descendants(program).flatMap((node): readonly unknown[] => {
      if (field(node, 'type') === 'ObjectMethod') {
        return hooks.has(field(node, 'key', 'name')) ? [node] : [];
      }

      if (!isHookValue(node)) {
        return [];
      }

      const hook = isFunction(node)
        ? node
        : declaredFunction(scope.bindingOf(node));

      return hook === undefined ? [] : [hook];
    }),
  );
}

/** The function a binding names: `function <name>() {}`, or `const <name> = <function>`. */
function declaredFunction(binding: Binding | undefined): unknown {
  const declaration = binding?.declaration;
  const init = field(declaration, 'init');

  if (binding?.kind === 'function') {
    return declaration;
  }

  return field(declaration, 'id') === binding?.identifier && isFunction(init)
    ? init
    : undefined;
}

/** Reads every interaction of one file, once, from its Program. Accepts Babel 7 and Babel 8 trees. `shapes` is `csfShapes(program)`. */
export function interactionsOf(
  program: unknown,
  shapes: CsfShapes,
): StoryInteractions {
  const tree = indexTree(program);
  const scope = fileScope(program);
  const isInTestCode = (node: unknown): boolean =>
    isNode(node) &&
    (shapes.testCode.has(node) || isInTestCode(tree.parentOf(node)));
  const hookFunctions = hooksOf(program, tree, scope);
  const isInHook = (node: unknown): boolean =>
    isNode(node) && (hookFunctions.has(node) || isInHook(tree.parentOf(node)));
  const isUnderComputedKey = (node: unknown): boolean =>
    field(node, 'computed') === true ||
    field(tree.parentOf(node), 'computed') === true;
  const originOf = userEventOrigins(
    tree,
    scope,
    new Set(
      [...shapes.testCode].filter(
        (node) => isNode(node) && !isUnderComputedKey(node),
      ),
    ),
  );
  const kindOf = (call: unknown): Kind | undefined => {
    if (!callTypes.includes(field(call, 'type'))) {
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
  /** A site: an expression statement, or the expression body of an arrow given to `step(...)`. */
  const siteOf = (node: unknown): Interaction['site'] | undefined => {
    if (field(node, 'type') === 'ExpressionStatement') {
      return 'statement';
    }

    const arrow = tree.parentOf(node);

    return field(arrow, 'type') === 'ArrowFunctionExpression' &&
      field(arrow, 'body') === node &&
      field(node, 'type') !== 'BlockStatement' &&
      isStepCall(tree.parentOf(arrow))
      ? 'stepBody'
      : undefined;
  };
  const sites = descendants(program).flatMap((node) => {
    const site = siteOf(node);

    if (site === undefined) {
      return [];
    }

    const call = awaited(
      site === 'statement' ? field(node, 'expression') : node,
    );
    const kind = kindOf(call);
    const args = list(field(call, 'arguments'));

    return kind === undefined
      ? []
      : [
          {
            read: {
              site,
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
  const reads: ReadonlyMap<unknown, SiteRead> = new Map(
    sites.map(({ read }) => [read.node, read]),
  );
  const followingChecksOf = followingChecksReader(tree, scope, (node) =>
    reads.get(node),
  );
  const all: readonly Interaction[] = sites.map(({ read, kind }) => ({
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
