import { field, list } from './node-field.ts';
import {
  awaited,
  childNodes,
  descendants,
  equivalent,
  isFunction,
  isNode,
  memberName,
  type TreeIndex,
} from './node-tree.ts';

export interface Check {
  readonly node: unknown;
  /** `expect`: `expect(...)`, or `expect.soft`, `expect.element` or `expect.poll`; `query`: a failing query, `find(All)?By*` or `get(All)?By*`, which throws when it finds nothing. */
  readonly kind: 'expect' | 'query';
  /** `.not` in the member chain after an expect call; a query is never negative. */
  readonly negative: boolean;
}

/** The statement that ends the following checks. */
export type WindowEnd =
  | {
      readonly by: 'interaction';
      /** The ending site; `at(node)` gives its interaction. */
      readonly node: unknown;
      /** It stands in this interaction's own statement list. */
      readonly sameList: boolean;
      /** It is the very next statement of this interaction's own statement list. */
      readonly adjacent: boolean;
      /** Its first argument is structurally equivalent to this one's, positions and comments aside. */
      readonly sameTarget: boolean;
    }
  | { readonly by: 'step' }
  | { readonly by: 'maybe' }
  | { readonly by: 'none' };

export interface FollowingChecks {
  /** Source order. */
  readonly checks: readonly Check[];
  readonly end: WindowEnd;
  /** The statement LzStorybookAssertionBefore copies before the interaction, or `undefined`. */
  readonly copy: unknown;
}

/** `findBy*`, `findAllBy*`, `getBy*` and `getAllBy*`, on any receiver or none; `queryBy*` finds nothing quietly. */
const failingQuery = /^(find|get)(All)?By/;

/** The members of `expect` whose call is a check, read through `memberName`; `expect.anything()` and `expect.assertions()` are none. */
const expectMembers: ReadonlySet<unknown> = new Set([
  'soft',
  'element',
  'poll',
]);

/** `expect`, or `expect.soft`, `expect.element` or `expect.poll`. */
function isExpectCallee(callee: unknown): boolean {
  return (
    field(callee, 'name') === 'expect' ||
    (field(callee, 'object', 'name') === 'expect' &&
      expectMembers.has(memberName(callee)))
  );
}

/** `.not` in the chain going outward from `node`, through member objects and call callees. */
function isNegated(node: unknown, tree: TreeIndex): boolean {
  const parent = tree.parentOf(node);

  return (
    (field(parent, 'object') === node || field(parent, 'callee') === node) &&
    (memberName(parent) === 'not' || isNegated(parent, tree))
  );
}

/** The check that `node` is, when it is a check call. */
function checkOf(node: unknown, tree: TreeIndex): Check | undefined {
  if (field(node, 'type') !== 'CallExpression') {
    return undefined;
  }

  const callee = field(node, 'callee');

  if (isExpectCallee(callee)) {
    return {
      node,
      kind: 'expect',
      negative: isNegated(node, tree),
    };
  }

  const name = memberName(callee) ?? field(callee, 'name');

  return typeof name === 'string' && failingQuery.test(name)
    ? { node, kind: 'query', negative: false }
    : undefined;
}

/** An argument of a call that `isCall` accepts. */
function isCallbackOf(
  node: unknown,
  tree: TreeIndex,
  isCall: (call: unknown) => boolean,
): boolean {
  const call = tree.parentOf(node);

  return isCall(call) && list(field(call, 'arguments')).includes(node);
}

/** `step(...)` or `waitFor(...)`, which run the function given to them. */
function runsCallback(node: unknown): boolean {
  return (
    isStepCall(node) ||
    (field(node, 'type') === 'CallExpression' &&
      field(node, 'callee', 'name') === 'waitFor')
  );
}

/** The statements after `node` in its list, then after each enclosing statement in its own, up to the function around it unless that function is given to `step(...)`. */
function laterStatements(node: unknown, tree: TreeIndex): readonly unknown[] {
  if (
    !isNode(node) ||
    (isFunction(node) && !isCallbackOf(node, tree, isStepCall))
  ) {
    return [];
  }

  const statements = tree.listOf(node) ?? [];

  return [
    ...statements.slice(statements.indexOf(node) + 1),
    ...laterStatements(tree.parentOf(node), tree),
  ];
}

/** Whether `node` is or holds a site outside any function, or anywhere in a function given to `step(...)` or `waitFor(...)`; any other function holds nothing. */
function holdsInteraction(
  node: unknown,
  tree: TreeIndex,
  isSite: (node: unknown) => boolean,
): boolean {
  if (isFunction(node) && isCallbackOf(node, tree, runsCallback)) {
    return descendants(node).some(isSite);
  }

  return (
    isSite(node) ||
    (!isFunction(node) &&
      childNodes(node).some((child) => holdsInteraction(child, tree, isSite)))
  );
}

/** An interaction's site and the arguments of its call. */
export interface SiteRead {
  readonly node: unknown;
  readonly args: readonly unknown[];
}

/** The checks that follow the interaction at `read`: in the statements after it, up to the first that is or holds an interaction. `siteAt` gives the interaction whose site is a node. */
export function followingChecksOf(
  read: SiteRead,
  tree: TreeIndex,
  siteAt: (node: unknown) => SiteRead | undefined,
): FollowingChecks {
  const isSite = (node: unknown): boolean => siteAt(node) !== undefined;
  const later = laterStatements(read.node, tree);
  const cut = later.find((statement) =>
    holdsInteraction(statement, tree, isSite),
  );
  const window = cut === undefined ? later : later.slice(0, later.indexOf(cut));

  return {
    checks: window.flatMap(descendants).flatMap((node) => {
      const check = checkOf(node, tree);

      return check === undefined ? [] : [check];
    }),
    end: endAt(cut, read, tree, siteAt),
    copy: undefined,
  };
}

/** What ends the window of `read` at `cut`, the first later statement that is or holds an interaction, if any. */
function endAt(
  cut: unknown,
  read: SiteRead,
  tree: TreeIndex,
  siteAt: (node: unknown) => SiteRead | undefined,
): WindowEnd {
  if (cut === undefined) {
    return { by: 'none' };
  }

  const ending = siteAt(cut);

  if (ending === undefined) {
    return isStepCall(awaited(field(cut, 'expression')))
      ? { by: 'step' }
      : { by: 'maybe' };
  }

  const statements = tree.listOf(read.node) ?? [];

  return {
    by: 'interaction',
    node: cut,
    sameList: tree.listOf(cut) === statements,
    adjacent: statements[statements.indexOf(read.node) + 1] === cut,
    sameTarget:
      read.args[0] !== undefined && equivalent(read.args[0], ending.args[0]),
  };
}

/** `step(...)`, or `<context>.step(...)` on a play context that is not destructured. */
export function isStepCall(node: unknown): boolean {
  const callee = field(node, 'callee');

  return (
    field(node, 'type') === 'CallExpression' &&
    (field(callee, 'name') === 'step' ||
      (field(callee, 'type') === 'MemberExpression' &&
        field(callee, 'object', 'type') === 'Identifier' &&
        memberName(callee) === 'step'))
  );
}
