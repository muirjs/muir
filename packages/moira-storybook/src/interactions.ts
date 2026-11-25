import type { MuirMoiraStorybookCsfShapes } from './csf.ts';
import {
  muirMoiraStorybookIsCall,
  muirMoiraStorybookIsMember,
  muirMoiraStorybookPrimitiveLiteralOf,
  muirMoiraStorybookUnwrap,
} from './csf-nodes.ts';
import {
  type MuirMoiraStorybookFollowingChecks,
  muirMoiraStorybookFollowingChecksReader,
  muirMoiraStorybookIsStepCall,
  type MuirMoiraStorybookStatementRead,
  muirMoiraStorybookTargetOf,
} from './following-checks.ts';
import {
  muirMoiraStorybookField,
  muirMoiraStorybookList,
} from './node-field.ts';
import {
  muirMoiraStorybookAwaited,
  muirMoiraStorybookDescendants,
  muirMoiraStorybookIndexTree,
  muirMoiraStorybookIsFunction,
  muirMoiraStorybookIsNode,
  muirMoiraStorybookMemberName,
  type MuirMoiraStorybookTreeIndex,
} from './node-tree.ts';
import {
  type MuirMoiraStorybookFileScope,
  muirMoiraStorybookFileScope,
  muirMoiraStorybookFunctionsOf,
} from './scope.ts';
import {
  type MuirMoiraStorybookUserEventOrigin,
  muirMoiraStorybookUserEventMethods,
  muirMoiraStorybookUserEventOrigins,
} from './user-event-origin.ts';

export type {
  MuirMoiraStorybookCheck,
  MuirMoiraStorybookFollowingChecks,
  MuirMoiraStorybookWindowEnd,
} from './following-checks.ts';
export type { MuirMoiraStorybookUserEventOrigin } from './user-event-origin.ts';

type Kind =
  | {
      readonly kind: 'userEvent';
      /** `undefined` for a computed key that is not a string literal. */
      readonly method: string | undefined;
      readonly origin: MuirMoiraStorybookUserEventOrigin;
    }
  | { readonly kind: 'fireEvent'; readonly method: string | undefined }
  | { readonly kind: 'composedPlay' | 'rawDom'; readonly method: string };

export type MuirMoiraStorybookInteraction = {
  /** The statement: an expression statement, or the expression body of an arrow. Its identity is the join key. */
  readonly node: unknown;
  /** The call, without `await`, optional chaining or type wrappers. */
  readonly call: unknown;
  readonly args: readonly unknown[];
  /** The first argument without `await` or type wrappers, or, for a name the file binds once by `const`, that const's init without `await`. */
  readonly targetValue: unknown;
  /** Stands in a `beforeEach` or `afterEach` function. */
  readonly inHook: boolean;
  readonly following: MuirMoiraStorybookFollowingChecks;
} & Kind;

export interface MuirMoiraStorybookStoryInteractions {
  /** Source order. */
  readonly all: readonly MuirMoiraStorybookInteraction[];
  /** The interaction whose statement is `node`, by identity. */
  readonly at: (node: unknown) => MuirMoiraStorybookInteraction | undefined;
  /** The interaction whose target query is the call nearest around `node`. */
  readonly aimedAt: (
    node: unknown,
  ) => MuirMoiraStorybookInteraction | undefined;
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
  const inner = muirMoiraStorybookUnwrap(node);

  return (
    muirMoiraStorybookField(inner, 'type') === 'Identifier' ||
    (muirMoiraStorybookIsMember(inner) &&
      startsAtIdentifier(muirMoiraStorybookField(inner, 'object')))
  );
}

/** `<Story>.play`, where `<Story>` starts at an identifier, such as `Other`, `Stories.Other` or `Stories?.Other`. */
function isStoryPlay(argument: unknown): boolean {
  const node = muirMoiraStorybookUnwrap(argument);

  return (
    muirMoiraStorybookIsMember(node) &&
    startsAtIdentifier(muirMoiraStorybookField(node, 'object')) &&
    muirMoiraStorybookMemberName(node) === 'play'
  );
}

/** `node` when it is a call, else the nearest call around it. */
function callAround(tree: MuirMoiraStorybookTreeIndex, node: unknown): unknown {
  return [node, ...tree.ancestors(node)].find(
    (each) => muirMoiraStorybookField(each, 'type') === 'CallExpression',
  );
}

/**
 * The `beforeEach` and `afterEach` functions of a file: a method of such a name, and the value of such a property or
 * each element of its array, under an identifier, a string or a template literal with no expression, computed or not. A value is a function, or a name that holds the
 * functions `functionsOf` gives. The property's value, the array and each element are read through parentheses,
 * casts and non-null assertions.
 */
function hooksOf(
  program: unknown,
  scope: MuirMoiraStorybookFileScope,
): ReadonlySet<unknown> {
  return new Set(
    muirMoiraStorybookDescendants(program).flatMap(
      (node): readonly unknown[] => {
        if (
          !hooks.has(
            muirMoiraStorybookField(node, 'key', 'name') ??
              muirMoiraStorybookPrimitiveLiteralOf(
                muirMoiraStorybookField(node, 'key'),
              )?.value,
          )
        ) {
          // Stryker disable next-line ArrayDeclaration: the hook set is searched for function nodes, and a string is none
          return [];
        }

        if (muirMoiraStorybookField(node, 'type') === 'ObjectMethod') {
          return [node];
        }

        if (muirMoiraStorybookField(node, 'type') !== 'ObjectProperty') {
          // Stryker disable next-line ArrayDeclaration: the hook set is searched for function nodes, and a string is none
          return [];
        }

        const value = muirMoiraStorybookUnwrap(
          muirMoiraStorybookField(node, 'value'),
        );
        const values =
          muirMoiraStorybookField(value, 'type') === 'ArrayExpression'
            ? muirMoiraStorybookList(
                muirMoiraStorybookField(value, 'elements'),
              ).map(muirMoiraStorybookUnwrap)
            : [value];

        return values.flatMap((each) =>
          muirMoiraStorybookIsFunction(each)
            ? [each]
            : muirMoiraStorybookFunctionsOf(scope.bindingOf(each)),
        );
      },
    ),
  );
}

/** Reads every interaction of one file, once, from its Program. Accepts Babel 7 and Babel 8 trees. `shapes` is `csfShapes(program)`. */
export function muirMoiraStorybookInteractionsOf(
  program: unknown,
  shapes: MuirMoiraStorybookCsfShapes,
): MuirMoiraStorybookStoryInteractions {
  const tree = muirMoiraStorybookIndexTree(program);
  const scope = muirMoiraStorybookFileScope(program);
  const isInTestCode = (node: unknown): boolean =>
    [node, ...tree.ancestors(node)].some((each) => shapes.testCode.has(each));
  const hookFunctions = hooksOf(program, scope);
  const isInHook = (node: unknown): boolean =>
    [node, ...tree.ancestors(node)].some((each) => hookFunctions.has(each));
  const isUnderComputedKey = (node: unknown): boolean =>
    muirMoiraStorybookField(node, 'computed') === true ||
    muirMoiraStorybookField(tree.parentOf(node), 'computed') === true;
  const originOf = muirMoiraStorybookUserEventOrigins(
    program,
    tree,
    scope,
    new Set(
      [...shapes.testCode].filter(
        (node) => muirMoiraStorybookIsNode(node) && !isUnderComputedKey(node),
      ),
    ),
  );
  const kindOf = (call: unknown): Kind | undefined => {
    if (!muirMoiraStorybookIsCall(call)) {
      return undefined;
    }

    const callee = muirMoiraStorybookUnwrap(
      muirMoiraStorybookField(call, 'callee'),
    );
    const method = muirMoiraStorybookMemberName(callee);
    const receiver = muirMoiraStorybookField(callee, 'object');
    const actsOnPage =
      method === undefined
        ? muirMoiraStorybookField(callee, 'computed') === true
        : muirMoiraStorybookUserEventMethods.has(method);
    const origin = actsOnPage ? originOf(receiver) : undefined;

    if (origin !== undefined) {
      return { kind: 'userEvent', method, origin };
    }

    const fireEvent = muirMoiraStorybookIsMember(callee)
      ? muirMoiraStorybookUnwrap(receiver)
      : callee;

    if (muirMoiraStorybookField(fireEvent, 'name') === 'fireEvent') {
      return { kind: 'fireEvent', method };
    }

    if (muirMoiraStorybookIsStepCall(call)) {
      return isStoryPlay(
        muirMoiraStorybookList(muirMoiraStorybookField(call, 'arguments'))[1],
      )
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

    return rawDomArguments.get(method) ===
      muirMoiraStorybookList(muirMoiraStorybookField(call, 'arguments')).length
      ? { kind: 'rawDom', method }
      : undefined;
  };
  /** `node`, or, for a name the file binds once by `const`, that const's init without `await`. */
  const valueOf = (node: unknown): unknown => {
    const binding = scope.bindingOf(node);
    const declaration = binding?.declaration;

    return binding?.kind === 'const' &&
      muirMoiraStorybookField(declaration, 'id') === binding.identifier
      ? muirMoiraStorybookAwaited(muirMoiraStorybookField(declaration, 'init'))
      : node;
  };
  /** The expression `node` stands for as a statement: an expression statement's expression, or `node` itself when it is its parent's `body`, which among expressions only an arrow's expression body is; `undefined` otherwise. */
  const statementExpressionOf = (node: unknown): unknown =>
    muirMoiraStorybookField(node, 'type') === 'ExpressionStatement'
      ? muirMoiraStorybookField(node, 'expression')
      : muirMoiraStorybookField(tree.parentOf(node), 'body') === node
        ? node
        : undefined;
  const found = muirMoiraStorybookDescendants(program).flatMap((node) => {
    const call = muirMoiraStorybookAwaited(statementExpressionOf(node));
    const kind = kindOf(call);
    const args = muirMoiraStorybookList(
      muirMoiraStorybookField(call, 'arguments'),
    );

    return kind === undefined
      ? []
      : [
          {
            read: {
              node,
              call,
              args,
              targetValue: valueOf(muirMoiraStorybookTargetOf({ node, args })),
              inHook: isInHook(node),
            },
            kind,
          },
        ];
  });
  const reads: ReadonlyMap<unknown, MuirMoiraStorybookStatementRead> = new Map(
    found.map(({ read }) => [read.node, read]),
  );
  const followingChecksOf = muirMoiraStorybookFollowingChecksReader(
    tree,
    scope,
    (node) => reads.get(node),
  );
  const all: readonly MuirMoiraStorybookInteraction[] = found.map(
    ({ read, kind }) => ({
      ...read,
      ...kind,
      following: followingChecksOf(read),
    }),
  );
  const byNode: ReadonlyMap<unknown, MuirMoiraStorybookInteraction> = new Map(
    all.map((interaction) => [interaction.node, interaction]),
  );

  return {
    all,
    at: (node) => byNode.get(node),
    aimedAt: (node) => {
      const query = callAround(tree, tree.parentOf(node));

      return query === undefined
        ? undefined
        : all.find(
            (interaction) => muirMoiraStorybookTargetOf(interaction) === query,
          );
    },
  };
}
