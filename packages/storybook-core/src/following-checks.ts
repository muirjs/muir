import { isCall, isMember, unwrap } from './csf-nodes.ts';
import { field, list } from './node-field.ts';
import {
  awaited,
  childNodes,
  descendants,
  equivalenceTokens,
  equivalent,
  isFunction,
  isNode,
  memberName,
  type TreeIndex,
} from './node-tree.ts';
import { type Binding, type FileScope, functionsOf } from './scope.ts';

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
      /** The ending interaction's statement; `at(node)` gives its interaction. */
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
  /** For each window statement in turn, the checks it runs, in source order, with those of a function it runs by name where that name stands. */
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

/**
 * `node` and every node below it that runs when it runs: a function runs nothing unless `runsWhereItStands`, and a
 * name that `runsWhereItStands` runs the body of each function `functionsRun` gives it, once. When
 * `outsideBranches`, what `isBranch` holds is left out, as it may not run.
 */
function nodesRunBy(
  node: unknown,
  tree: TreeIndex,
  scope: FileScope,
  outsideBranches = false,
): readonly unknown[] {
  // Stryker disable next-line ArrayDeclaration: a string among the nodes that run changes no result, as checkOf and statementAt find nothing in a string
  const found: unknown[] = [];
  const called = new Set<unknown>();
  const pending = [node];

  while (pending.length > 0) {
    const each = pending.pop();
    const runs = runsWhereItStands(each, tree);

    if (
      (isFunction(each) && !runs) ||
      (outsideBranches && isBranch(each, tree))
    ) {
      continue;
    }

    found.push(each);

    const bodies = functionsRun(
      runs ? scope.bindingOf(each) : undefined,
      scope,
    ).filter((body) => !called.has(body));

    bodies.forEach((body) => called.add(body));
    pending.push(
      ...[...childNodes(each), ...bodies.flatMap(childNodes)].reverse(),
    );
  }

  return found;
}

const branchingTypes: ReadonlySet<unknown> = new Set([
  'IfStatement',
  'SwitchCase',
  'CatchClause',
]);

/** What an `if`, a `switch` case or a `catch` runs, apart from its test. */
function isBranch(node: unknown, tree: TreeIndex): boolean {
  const parent = tree.parentOf(node);

  return (
    branchingTypes.has(field(parent, 'type')) && field(parent, 'test') !== node
  );
}

/**
 * A node called where it stands, or given as an argument to a call or `new`, which may run it, through any casts and
 * parentheses around it. Only a call or `new` has arguments.
 */
function runsWhereItStands(node: unknown, tree: TreeIndex): boolean {
  const outer = outermostWrapper(node, tree);
  const parent = tree.parentOf(outer);

  return (
    field(parent, 'callee') === outer ||
    list(field(parent, 'arguments')).includes(outer)
  );
}

/** `node`, or the outermost cast, non-null assertion or parentheses around it. */
function outermostWrapper(node: unknown, tree: TreeIndex): unknown {
  const parent = tree.parentOf(node);

  return unwrap(parent) === unwrap(node)
    ? outermostWrapper(parent, tree)
    : node;
}

/** The statements after `node` in its list, then after each enclosing statement in its own, up to the function around it unless that function is given to `step(...)`. */
function laterStatements(node: unknown, tree: TreeIndex): readonly unknown[] {
  if (
    !isNode(node) ||
    (isFunction(node) && !isCallbackOf(node, tree, isStepCall))
  ) {
    // Stryker disable next-line ArrayDeclaration: a string among the later statements changes no result, as nodesRunBy, checkOf and statementAt find nothing in a string
    return [];
  }

  const statements = list(tree.listOf(node));

  return [
    ...statements.slice(statements.indexOf(node) + 1),
    ...laterStatements(tree.parentOf(node), tree),
  ];
}

/** An interaction's statement and the arguments of its call. */
export interface StatementRead {
  readonly node: unknown;
  readonly args: readonly unknown[];
}

/** The target of an interaction: its first argument without `await` or type wrappers. */
export function targetOf(read: StatementRead): unknown {
  return awaited(read.args[0]);
}

/** The nodes of one function that are `equivalent` to the statement it is given. */
type EquivalentStatements = (statement: unknown) => readonly unknown[];

/** Gives the checks that follow the interaction at a read: in the statements after it, up to the first that is or holds an interaction. `statementAt` gives the interaction whose statement is a node. */
export function followingChecksReader(
  tree: TreeIndex,
  scope: FileScope,
  statementAt: (node: unknown) => StatementRead | undefined,
): (read: StatementRead) => FollowingChecks {
  const equivalentStatementsIn = readOnce((outermost): EquivalentStatements => {
    const tokenOf = equivalenceTokens([outermost]);
    const statements = Map.groupBy(descendants(outermost), tokenOf);

    return (statement) => list(statements.get(tokenOf(statement)));
  });
  const isInteractionStatement = (node: unknown): boolean =>
    statementAt(node) !== undefined;
  /** Interactions in one `switch` or `else if` chain share the statements after it, so each statement is read once. */
  const runBy = readOnce((statement) => nodesRunBy(statement, tree, scope));
  const holdsAnInteraction = readOnce((statement) =>
    runBy(statement).some(isInteractionStatement),
  );
  const holdsAnInteractionOutsideBranches = readOnce((statement) =>
    nodesRunBy(statement, tree, scope, true).some(isInteractionStatement),
  );
  const checksIn = readOnce((statement) =>
    runBy(statement).flatMap((node) => {
      const check = checkOf(node, tree);

      return check === undefined ? [] : [check];
    }),
  );

  return (read) => {
    const later = laterStatements(read.node, tree);
    const cut = later.find(holdsAnInteraction);
    const window =
      cut === undefined ? later : later.slice(0, later.indexOf(cut));
    const checks = window.flatMap(checksIn);
    const firstExpect = checks.find((check) => check.kind === 'expect');

    return {
      checks,
      end: endAt(
        cut,
        read,
        tree,
        statementAt,
        holdsAnInteractionOutsideBranches,
      ),
      copy: copyOf(
        window.find((statement) =>
          checksIn(statement).some((check) => check === firstExpect),
        ),
        read,
        tree,
        scope,
        equivalentStatementsIn(outermostFunction(read.node, tree)),
      ),
    };
  };
}

/** `read`, which gives the same value for a node each time, kept for each node it is given. */
function readOnce<T extends NonNullable<unknown>>(
  read: (node: unknown) => T,
): (node: unknown) => T {
  const known = new Map<unknown, T>();

  return (node) => {
    const found = known.get(node);

    if (found !== undefined) {
      return found;
    }

    const value = read(node);

    known.set(node, value);

    return value;
  };
}

/** `statement`, the window statement that holds the first expect check, when it may be copied before the interaction at `read`: one that `checksWhenRun`, in the interaction's own list. */
function copyOf(
  statement: unknown,
  read: StatementRead,
  tree: TreeIndex,
  scope: FileScope,
  equivalentStatements: EquivalentStatements,
): unknown {
  return tree.listOf(statement) === tree.listOf(read.node) &&
    checksWhenRun(statement) &&
    !readsNameSetBetween(read.node, statement, tree, scope) &&
    !standsEarlier(statement, read.node, equivalentStatements)
    ? statement
    : undefined;
}

/** Whether a statement equivalent to `statement`, in the outermost function around `interactionStatement`, ends by the start of `interactionStatement`; a node without positions stands nowhere. */
function standsEarlier(
  statement: unknown,
  interactionStatement: unknown,
  equivalentStatements: EquivalentStatements,
): boolean {
  const start = field(interactionStatement, 'start');

  return equivalentStatements(statement).some((node) => {
    const end = field(node, 'end');

    return typeof end === 'number' && typeof start === 'number' && end <= start;
  });
}

/** The outermost function around `node`, or `undefined` outside any. */
function outermostFunction(node: unknown, tree: TreeIndex): unknown {
  return tree.ancestors(node).filter(isFunction).at(-1);
}

/**
 * Whether `statement` reads a name that is declared or written between the interaction and it: in its list's
 * statements from `interactionStatement` up to `statement`, or in a function those statements name.
 * What `statement` reads includes what each function it names reads from outside that function, and so on for the
 * functions those name; a name holds the functions `functionsNamed` gives. A function declaration counts by its writes
 * only, as hoisting declares it before the interaction; a node without positions counts as not between.
 */
function readsNameSetBetween(
  interactionStatement: unknown,
  statement: unknown,
  tree: TreeIndex,
  scope: FileScope,
): boolean {
  const statements = list(tree.listOf(statement));
  const betweenStatements = statements.slice(
    statements.indexOf(interactionStatement),
    statements.indexOf(statement),
  );
  const between = new Set([
    ...betweenStatements,
    ...betweenStatements
      .flatMap((each) => bindingsReadThroughFunctions(each, scope, tree))
      .flatMap((binding) => functionsNamed(binding, scope)),
  ]);
  const isBetween = (node: unknown): boolean =>
    typeof field(node, 'start') === 'number' &&
    typeof field(interactionStatement, 'start') === 'number' &&
    typeof field(statement, 'start') === 'number' &&
    [node, ...tree.ancestors(node)].some((each) => between.has(each));

  return bindingsReadThroughFunctions(statement, scope, tree).some((binding) =>
    (binding.kind === 'function'
      ? binding.writes
      : [binding.identifier, ...binding.writes]
    ).some(isBetween),
  );
}

/**
 * `binding`, and for a variable declared as another name, that name's binding, and so on. A destructured variable
 * counts as declared as the whole value.
 */
function aliasChain(
  binding: Binding | undefined,
  scope: FileScope,
): readonly Binding[] {
  const chain: Binding[] = [];

  for (
    let each = binding;
    each !== undefined && !chain.includes(each);
    each = scope.bindingOf(initOf(each))
  ) {
    chain.push(each);
  }

  return chain;
}

/** The value `binding` is declared with, through any casts and parentheses around it. */
function initOf(binding: Binding): unknown {
  return unwrap(field(binding.declaration, 'init'));
}

/**
 * The functions that run where `binding`'s name is called or given to a call: those `functionsOf` gives each name in
 * its `aliasChain`, or all `functionsNamed` gives when a name in the chain is destructured, as it may be any function
 * of the value.
 */
function functionsRun(
  binding: Binding | undefined,
  scope: FileScope,
): readonly unknown[] {
  const chain = aliasChain(binding, scope);

  return chain.some(isDestructured)
    ? functionsNamed(binding, scope)
    : chain.flatMap(functionsOf);
}

/** A binding that is not the whole of what its declaration declares, such as `count` in `const { count } = counter`. */
function isDestructured(binding: Binding): boolean {
  return field(binding.declaration, 'id') !== binding.identifier;
}

/**
 * The functions `binding`'s name may reach: for each name in its `aliasChain`, those `functionsOf` gives it and, when
 * it is declared as an object literal, the methods and function values written in that literal. A function a property
 * holds by name, or one in a nested literal, is not among them.
 */
function functionsNamed(
  binding: Binding | undefined,
  scope: FileScope,
): readonly unknown[] {
  return aliasChain(binding, scope).flatMap((each) => [
    ...functionsOf(each),
    ...list(field(initOf(each), 'properties')).flatMap((property) =>
      [property, field(property, 'value')].filter(isFunction),
    ),
  ]);
}

function bindingsReadThroughFunctions(
  statement: unknown,
  scope: FileScope,
  tree: TreeIndex,
): readonly Binding[] {
  const found: Binding[] = [];
  const followed = new Set<unknown>();
  const pending = [statement];
  const isDeclaredIn = (binding: Binding, node: unknown): boolean =>
    tree.ancestors(binding.identifier).includes(node);

  while (pending.length > 0) {
    const node = pending.pop();
    const read = scope
      .referencesIn(node)
      .map(scope.bindingOf)
      .filter((binding) => binding !== undefined)
      .filter((binding) => !isDeclaredIn(binding, node));

    found.push(...read);

    for (const body of read.flatMap((binding) =>
      functionsNamed(binding, scope),
    )) {
      if (!followed.has(body)) {
        followed.add(body);
        pending.push(body);
      }
    }
  }

  return found;
}

/** An expression statement that is a check, or one that waits on its first argument whose first argument holds an expect check. */
function checksWhenRun(statement: unknown): boolean {
  const expression = awaited(field(statement, 'expression'));

  return (
    field(statement, 'type') === 'ExpressionStatement' &&
    (startsAtExpect(expression) ||
      (waitsOnFirstArgument(statement) &&
        descendants(list(field(expression, 'arguments'))[0]).some(
          isExpectCall,
        )))
  );
}

/** A `waitFor(...)` statement, or an awaited `<x>.then(...)` statement: the play waits on what its first argument runs. */
function waitsOnFirstArgument(statement: unknown): boolean {
  const expression = unwrap(field(statement, 'expression'));

  return (
    waitCall(statement) === 'waitFor' ||
    (field(expression, 'type') === 'AwaitExpression' &&
      memberName(field(awaited(expression), 'callee')) === 'then')
  );
}

/** What ends the window of `read` at `cut`, the first later statement that is or holds an interaction, if any. */
function endAt(
  cut: unknown,
  read: StatementRead,
  tree: TreeIndex,
  statementAt: (node: unknown) => StatementRead | undefined,
  holdsInteractionOutsideBranches: (node: unknown) => boolean,
): WindowEnd {
  if (cut === undefined) {
    return { by: 'none' };
  }

  const ending = statementAt(cut);

  if (ending === undefined) {
    return isStepCall(awaited(field(cut, 'expression'))) &&
      holdsInteractionOutsideBranches(cut)
      ? { by: 'step' }
      : { by: 'maybe' };
  }

  const statements = list(tree.listOf(read.node));

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

/** `step(...)`, or `<context>.step(...)` or `<context>?.step(...)` on a play context that is not destructured. */
export function isStepCall(node: unknown): boolean {
  const callee = field(node, 'callee');

  return (
    isCall(node) &&
    (field(callee, 'name') === 'step' ||
      (isMember(callee) &&
        field(callee, 'object', 'type') === 'Identifier' &&
        memberName(callee) === 'step'))
  );
}
