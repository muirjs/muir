import { field, list } from './node-field.ts';
import {
  awaited,
  childNodes,
  descendants,
  equivalent,
  isFunction,
  isNode,
  memberName,
  shapeKey,
  type TreeIndex,
} from './node-tree.ts';
import type { FileScope } from './scope.ts';

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
      /** Its target, the first argument without `await` or type wrappers, is structurally equivalent to this one's, positions and comments aside. */
      readonly sameTarget: boolean;
    }
  | { readonly by: 'step' }
  | { readonly by: 'maybe' }
  | { readonly by: 'none' };

export interface FollowingChecks {
  /** Source order. */
  readonly checks: readonly Check[];
  readonly end: WindowEnd;
  /** The statement that may be copied before the interaction, or `undefined`. */
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

/** Whether the chain going inward from `node`, through call callees and member objects, reaches an expect call. */
function startsAtExpect(node: unknown): boolean {
  return (
    isNode(node) &&
    (isExpectCall(node) ||
      startsAtExpect(field(node, 'callee') ?? field(node, 'object')))
  );
}

function isExpectCall(node: unknown): boolean {
  return (
    field(node, 'type') === 'CallExpression' &&
    isExpectCallee(field(node, 'callee'))
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
  return isStepCall(node) || waitCall(node) === 'waitFor';
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

/** The target of an interaction: its first argument without `await` or type wrappers. */
export function targetOf(read: SiteRead): unknown {
  return awaited(read.args[0]);
}

type StatementsByShape = ReadonlyMap<string, readonly unknown[]>;

/** Gives the checks that follow the interaction at a read: in the statements after it, up to the first that is or holds an interaction. `siteAt` gives the interaction whose site is a node. */
export function followingChecksReader(
  tree: TreeIndex,
  scope: FileScope,
  siteAt: (node: unknown) => SiteRead | undefined,
): (read: SiteRead) => FollowingChecks {
  const statementsByFunction = new Map<unknown, StatementsByShape>();
  /** The expression statements in the outermost function around `node`, by `shapeKey`, built once per function. */
  const expressionStatementsAround = (node: unknown): StatementsByShape => {
    const outermost = outermostFunction(node, tree);
    const known = statementsByFunction.get(outermost);

    if (known !== undefined) {
      return known;
    }

    const statements = Map.groupBy(
      descendants(outermost).filter(
        (each) => field(each, 'type') === 'ExpressionStatement',
      ),
      shapeKey,
    );

    statementsByFunction.set(outermost, statements);

    return statements;
  };

  return (read) =>
    followingChecksOf(read, tree, scope, siteAt, expressionStatementsAround);
}

function followingChecksOf(
  read: SiteRead,
  tree: TreeIndex,
  scope: FileScope,
  siteAt: (node: unknown) => SiteRead | undefined,
  expressionStatementsAround: (node: unknown) => StatementsByShape,
): FollowingChecks {
  const isSite = (node: unknown): boolean => siteAt(node) !== undefined;
  const later = laterStatements(read.node, tree);
  const cut = later.find((statement) =>
    holdsInteraction(statement, tree, isSite),
  );
  const window = cut === undefined ? later : later.slice(0, later.indexOf(cut));
  const checks = window.flatMap(descendants).flatMap((node) => {
    const check = checkOf(node, tree);

    return check === undefined ? [] : [check];
  });
  const firstExpect = checks.find((check) => check.kind === 'expect');

  return {
    checks,
    end: endAt(cut, read, tree, siteAt),
    copy: copyOf(
      window.find((statement) =>
        descendants(statement).includes(firstExpect?.node),
      ),
      read,
      tree,
      scope,
      expressionStatementsAround(read.node),
    ),
  };
}

/** `statement`, the window statement that holds the first expect check, when it may be copied before the interaction at `read`: a check statement, or a `waitFor(...)` statement whose callback holds an expect check, in the interaction's own list. */
function copyOf(
  statement: unknown,
  read: SiteRead,
  tree: TreeIndex,
  scope: FileScope,
  expressionStatements: StatementsByShape,
): unknown {
  return tree.listOf(statement) === tree.listOf(read.node) &&
    checksWhenRun(statement) &&
    !readsNameSetBetween(read.node, statement, scope) &&
    !standsEarlier(statement, read.node, expressionStatements)
    ? statement
    : undefined;
}

/** Whether one of `expressionStatements`, those of the outermost function around `site`, is equivalent to `statement` and ends by the start of `site`; a node without positions stands nowhere. */
function standsEarlier(
  statement: unknown,
  site: unknown,
  expressionStatements: StatementsByShape,
): boolean {
  const start = field(site, 'start');

  return (expressionStatements.get(shapeKey(statement)) ?? []).some((node) => {
    const end = field(node, 'end');

    return (
      typeof end === 'number' &&
      typeof start === 'number' &&
      end <= start &&
      equivalent(node, statement)
    );
  });
}

/** The outermost function around `node`, or `undefined` outside any. */
function outermostFunction(node: unknown, tree: TreeIndex): unknown {
  return tree.ancestors(node).filter(isFunction).at(-1);
}

/** Whether `statement` reads a name declared or written from the start of `site` up to its own start; a node without positions counts as not between. */
function readsNameSetBetween(
  site: unknown,
  statement: unknown,
  scope: FileScope,
): boolean {
  const from = field(site, 'start');
  const to = field(statement, 'start');
  const isBetween = (node: unknown): boolean => {
    const at = field(node, 'start');

    return (
      typeof at === 'number' &&
      typeof from === 'number' &&
      typeof to === 'number' &&
      at >= from &&
      at < to
    );
  };

  return scope.referencesIn(statement).some((name) => {
    const binding = scope.bindingOf(name);

    return [binding?.identifier, ...(binding?.writes ?? [])].some(isBetween);
  });
}

/** A check statement, or a `waitFor(...)` statement whose callback holds an expect check. */
function checksWhenRun(statement: unknown): boolean {
  const expression = awaited(field(statement, 'expression'));

  return (
    startsAtExpect(expression) ||
    (waitCall(statement) === 'waitFor' &&
      descendants(list(field(expression, 'arguments'))[0]).some(isExpectCall))
  );
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
      targetOf(read) !== undefined &&
      equivalent(targetOf(read), targetOf(ending)),
  };
}

const waitCalls: ReadonlyMap<unknown, 'waitFor' | 'removal'> = new Map([
  ['waitFor', 'waitFor'],
  ['waitForElementToBeRemoved', 'removal'],
]);

/** `'waitFor'` for a `waitFor(...)` call, `'removal'` for a `waitForElementToBeRemoved(...)` call, given as a statement, awaited or plain; `undefined` for anything else. */
export function waitCall(node: unknown): 'waitFor' | 'removal' | undefined {
  const call = awaited(
    field(node, 'type') === 'ExpressionStatement'
      ? field(node, 'expression')
      : node,
  );

  return field(call, 'type') === 'CallExpression'
    ? waitCalls.get(field(call, 'callee', 'name'))
    : undefined;
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
