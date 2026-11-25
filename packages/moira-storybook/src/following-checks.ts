import {
  muirMoiraStorybookIsCall,
  muirMoiraStorybookIsMember,
  muirMoiraStorybookUnwrap,
} from './csf-nodes.ts';
import {
  muirMoiraStorybookField,
  muirMoiraStorybookList,
} from './node-field.ts';
import {
  muirMoiraStorybookAwaited,
  muirMoiraStorybookChildNodes,
  muirMoiraStorybookDescendants,
  muirMoiraStorybookEquivalenceTokens,
  muirMoiraStorybookEquivalent,
  muirMoiraStorybookIsFunction,
  muirMoiraStorybookIsNode,
  muirMoiraStorybookMemberName,
  type MuirMoiraStorybookTreeIndex,
} from './node-tree.ts';
import {
  type MuirMoiraStorybookBinding,
  type MuirMoiraStorybookFileScope,
  muirMoiraStorybookFunctionsOf,
} from './scope.ts';

export interface MuirMoiraStorybookCheck {
  readonly node: unknown;
  /** `expect`: `expect(...)`, or `expect.soft`, `expect.element` or `expect.poll`; `query`: a failing query, `find(All)?By*` or `get(All)?By*`, which throws when it finds nothing. */
  readonly kind: 'expect' | 'query';
  /** `.not` in the member chain after an expect call; a query is never negative. */
  readonly negative: boolean;
}

/** The statement that ends the following checks. */
export type MuirMoiraStorybookWindowEnd =
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

export interface MuirMoiraStorybookFollowingChecks {
  /** For each window statement in turn, the checks it runs, in source order, with those of each function it runs by name where that name first stands. */
  readonly checks: readonly MuirMoiraStorybookCheck[];
  readonly end: MuirMoiraStorybookWindowEnd;
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
    muirMoiraStorybookField(callee, 'name') === 'expect' ||
    (muirMoiraStorybookField(callee, 'object', 'name') === 'expect' &&
      expectMembers.has(muirMoiraStorybookMemberName(callee)))
  );
}

/** Whether the chain going inward from `node`, through call callees and member objects, reaches an expect call. */
function startsAtExpect(node: unknown): boolean {
  return (
    muirMoiraStorybookIsNode(node) &&
    (isExpectCall(node) ||
      startsAtExpect(
        muirMoiraStorybookField(node, 'callee') ??
          muirMoiraStorybookField(node, 'object'),
      ))
  );
}

function isExpectCall(node: unknown): boolean {
  return (
    muirMoiraStorybookField(node, 'type') === 'CallExpression' &&
    isExpectCallee(muirMoiraStorybookField(node, 'callee'))
  );
}

/** `.not` in the chain going outward from `node`, through member objects and call callees. */
function isNegated(node: unknown, tree: MuirMoiraStorybookTreeIndex): boolean {
  const parent = tree.parentOf(node);

  return (
    (muirMoiraStorybookField(parent, 'object') === node ||
      muirMoiraStorybookField(parent, 'callee') === node) &&
    (muirMoiraStorybookMemberName(parent) === 'not' || isNegated(parent, tree))
  );
}

/** The check that `node` is, when it is a check call. */
function checkOf(
  node: unknown,
  tree: MuirMoiraStorybookTreeIndex,
): MuirMoiraStorybookCheck | undefined {
  if (muirMoiraStorybookField(node, 'type') !== 'CallExpression') {
    return undefined;
  }

  const callee = muirMoiraStorybookField(node, 'callee');

  if (isExpectCallee(callee)) {
    return {
      node,
      kind: 'expect',
      negative: isNegated(node, tree),
    };
  }

  const name =
    muirMoiraStorybookMemberName(callee) ??
    muirMoiraStorybookField(callee, 'name');

  return typeof name === 'string' && failingQuery.test(name)
    ? { node, kind: 'query', negative: false }
    : undefined;
}

/** An argument of a call that `isCall` accepts. */
function isCallbackOf(
  node: unknown,
  tree: MuirMoiraStorybookTreeIndex,
  isCall: (call: unknown) => boolean,
): boolean {
  const call = tree.parentOf(node);

  return (
    isCall(call) &&
    muirMoiraStorybookList(muirMoiraStorybookField(call, 'arguments')).includes(
      node,
    )
  );
}

/**
 * `node` and every node below it that runs when it runs: a function runs nothing unless `runsWhereItStands`, and a
 * name that `runsWhereItStands` runs the body of each function `functionsRun` gives it, once. When
 * `outsideBranches`, what `isBranch` holds is left out, as it may not run.
 */
function nodesRunBy(
  node: unknown,
  tree: MuirMoiraStorybookTreeIndex,
  scope: MuirMoiraStorybookFileScope,
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
      (muirMoiraStorybookIsFunction(each) && !runs) ||
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
      ...[
        ...muirMoiraStorybookChildNodes(each),
        ...bodies.flatMap(muirMoiraStorybookChildNodes),
      ].reverse(),
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
function isBranch(node: unknown, tree: MuirMoiraStorybookTreeIndex): boolean {
  const parent = tree.parentOf(node);

  return (
    branchingTypes.has(muirMoiraStorybookField(parent, 'type')) &&
    muirMoiraStorybookField(parent, 'test') !== node
  );
}

/**
 * A node called where it stands, or given as an argument to a call or `new`, which may run it, through any casts and
 * parentheses around it. Only a call or `new` has arguments.
 */
function runsWhereItStands(
  node: unknown,
  tree: MuirMoiraStorybookTreeIndex,
): boolean {
  const outer = outermostWrapper(node, tree);
  const parent = tree.parentOf(outer);

  return (
    muirMoiraStorybookField(parent, 'callee') === outer ||
    muirMoiraStorybookList(
      muirMoiraStorybookField(parent, 'arguments'),
    ).includes(outer)
  );
}

/** `node`, or the outermost cast, non-null assertion or parentheses around it. */
function outermostWrapper(
  node: unknown,
  tree: MuirMoiraStorybookTreeIndex,
): unknown {
  const parent = tree.parentOf(node);

  return muirMoiraStorybookUnwrap(parent) === muirMoiraStorybookUnwrap(node)
    ? outermostWrapper(parent, tree)
    : node;
}

/** The statements after `node` in its list, then after each enclosing statement in its own, up to the function around it unless that function is given to `step(...)`. */
function laterStatements(
  node: unknown,
  tree: MuirMoiraStorybookTreeIndex,
): readonly unknown[] {
  if (
    !muirMoiraStorybookIsNode(node) ||
    (muirMoiraStorybookIsFunction(node) &&
      !isCallbackOf(node, tree, muirMoiraStorybookIsStepCall))
  ) {
    // Stryker disable next-line ArrayDeclaration: a string among the later statements changes no result, as nodesRunBy, checkOf and statementAt find nothing in a string
    return [];
  }

  const statements = muirMoiraStorybookList(tree.listOf(node));

  return [
    ...statements.slice(statements.indexOf(node) + 1),
    ...laterStatements(tree.parentOf(node), tree),
  ];
}

/** An interaction's statement and the arguments of its call. */
export interface MuirMoiraStorybookStatementRead {
  readonly node: unknown;
  readonly args: readonly unknown[];
}

/** The target of an interaction: its first argument without `await` or type wrappers. */
export function muirMoiraStorybookTargetOf(
  read: MuirMoiraStorybookStatementRead,
): unknown {
  return muirMoiraStorybookAwaited(read.args[0]);
}

/** The nodes of one function that are `equivalent` to the statement it is given. */
type EquivalentStatements = (statement: unknown) => readonly unknown[];

/** Gives the checks that follow the interaction at a read: in the statements after it, up to the first that is or holds an interaction. `statementAt` gives the interaction whose statement is a node. */
export function muirMoiraStorybookFollowingChecksReader(
  tree: MuirMoiraStorybookTreeIndex,
  scope: MuirMoiraStorybookFileScope,
  statementAt: (node: unknown) => MuirMoiraStorybookStatementRead | undefined,
): (
  read: MuirMoiraStorybookStatementRead,
) => MuirMoiraStorybookFollowingChecks {
  const equivalentStatementsIn = readOnce((outermost): EquivalentStatements => {
    const tokenOf = muirMoiraStorybookEquivalenceTokens([outermost]);
    const statements = Map.groupBy(
      muirMoiraStorybookDescendants(outermost),
      tokenOf,
    );

    return (statement) =>
      muirMoiraStorybookList(statements.get(tokenOf(statement)));
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
  read: MuirMoiraStorybookStatementRead,
  tree: MuirMoiraStorybookTreeIndex,
  scope: MuirMoiraStorybookFileScope,
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
  const start = muirMoiraStorybookField(interactionStatement, 'start');

  return equivalentStatements(statement).some((node) => {
    const end = muirMoiraStorybookField(node, 'end');

    return typeof end === 'number' && typeof start === 'number' && end <= start;
  });
}

/** The outermost function around `node`, or `undefined` outside any. */
function outermostFunction(
  node: unknown,
  tree: MuirMoiraStorybookTreeIndex,
): unknown {
  return tree.ancestors(node).filter(muirMoiraStorybookIsFunction).at(-1);
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
  tree: MuirMoiraStorybookTreeIndex,
  scope: MuirMoiraStorybookFileScope,
): boolean {
  const statements = muirMoiraStorybookList(tree.listOf(statement));
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
    typeof muirMoiraStorybookField(node, 'start') === 'number' &&
    typeof muirMoiraStorybookField(interactionStatement, 'start') ===
      'number' &&
    typeof muirMoiraStorybookField(statement, 'start') === 'number' &&
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
  binding: MuirMoiraStorybookBinding | undefined,
  scope: MuirMoiraStorybookFileScope,
): readonly MuirMoiraStorybookBinding[] {
  const chain: MuirMoiraStorybookBinding[] = [];

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
function initOf(binding: MuirMoiraStorybookBinding): unknown {
  return muirMoiraStorybookUnwrap(
    muirMoiraStorybookField(binding.declaration, 'init'),
  );
}

/**
 * The functions that run where `binding`'s name is called or given to a call: those `functionsOf` gives each name in
 * its `aliasChain`, or all `functionsNamed` gives when a name in the chain is destructured, as it may be any function
 * of the value.
 */
function functionsRun(
  binding: MuirMoiraStorybookBinding | undefined,
  scope: MuirMoiraStorybookFileScope,
): readonly unknown[] {
  const chain = aliasChain(binding, scope);

  return chain.some(isDestructured)
    ? functionsNamed(binding, scope)
    : chain.flatMap(muirMoiraStorybookFunctionsOf);
}

/**
 * A binding whose declaration's `id` is not its identifier: a destructured variable, such as `count` in
 * `const { count } = counter`, and also a parameter, a catch parameter or an import, which have no value to follow.
 */
function isDestructured(binding: MuirMoiraStorybookBinding): boolean {
  return (
    muirMoiraStorybookField(binding.declaration, 'id') !== binding.identifier
  );
}

/**
 * The functions `binding`'s name may reach: for each name in its `aliasChain`, those `functionsOf` gives it and, when
 * it is declared as an object literal, the methods and function values written in that literal. A function a property
 * holds by name, or one in a nested literal, is not among them.
 */
function functionsNamed(
  binding: MuirMoiraStorybookBinding | undefined,
  scope: MuirMoiraStorybookFileScope,
): readonly unknown[] {
  return aliasChain(binding, scope).flatMap((each) => [
    ...muirMoiraStorybookFunctionsOf(each),
    ...muirMoiraStorybookList(
      muirMoiraStorybookField(initOf(each), 'properties'),
    ).flatMap((property) =>
      [property, muirMoiraStorybookField(property, 'value')].filter(
        muirMoiraStorybookIsFunction,
      ),
    ),
  ]);
}

function bindingsReadThroughFunctions(
  statement: unknown,
  scope: MuirMoiraStorybookFileScope,
  tree: MuirMoiraStorybookTreeIndex,
): readonly MuirMoiraStorybookBinding[] {
  const found: MuirMoiraStorybookBinding[] = [];
  const followed = new Set<unknown>();
  const pending = [statement];
  const isDeclaredIn = (
    binding: MuirMoiraStorybookBinding,
    node: unknown,
  ): boolean => tree.ancestors(binding.identifier).includes(node);

  while (pending.length > 0) {
    const node = pending.pop();
    const read = scope
      .referencesIn(node)
      .map(scope.bindingOf)
      .filter((binding) => binding !== undefined)
      .filter((binding) => !isDeclaredIn(binding, node));

    found.push(...read);

    const bodies = [
      ...new Set(read.flatMap((binding) => functionsNamed(binding, scope))),
    ].filter((body) => !followed.has(body));

    bodies.forEach((body) => followed.add(body));
    pending.push(...bodies);
  }

  return found;
}

/** An expression statement that is a check, or one that `waitsOnFirstArgument` whose first argument holds an expect check. */
function checksWhenRun(statement: unknown): boolean {
  const expression = muirMoiraStorybookAwaited(
    muirMoiraStorybookField(statement, 'expression'),
  );

  return (
    muirMoiraStorybookField(statement, 'type') === 'ExpressionStatement' &&
    (startsAtExpect(expression) ||
      (waitsOnFirstArgument(statement) &&
        muirMoiraStorybookDescendants(
          muirMoiraStorybookList(
            muirMoiraStorybookField(expression, 'arguments'),
          )[0],
        ).some(isExpectCall)))
  );
}

/** A `waitFor(...)` statement, awaited or not, or an awaited `<x>.then(...)` statement. */
function waitsOnFirstArgument(statement: unknown): boolean {
  const expression = muirMoiraStorybookUnwrap(
    muirMoiraStorybookField(statement, 'expression'),
  );

  return (
    muirMoiraStorybookWaitCall(statement) === 'waitFor' ||
    (muirMoiraStorybookField(expression, 'type') === 'AwaitExpression' &&
      muirMoiraStorybookMemberName(
        muirMoiraStorybookField(
          muirMoiraStorybookAwaited(expression),
          'callee',
        ),
      ) === 'then')
  );
}

/** What ends the window of `read` at `cut`, the first later statement that is or holds an interaction, if any. */
function endAt(
  cut: unknown,
  read: MuirMoiraStorybookStatementRead,
  tree: MuirMoiraStorybookTreeIndex,
  statementAt: (node: unknown) => MuirMoiraStorybookStatementRead | undefined,
  holdsAnInteractionOutsideBranches: (node: unknown) => boolean,
): MuirMoiraStorybookWindowEnd {
  if (cut === undefined) {
    return { by: 'none' };
  }

  const ending = statementAt(cut);

  if (ending === undefined) {
    return muirMoiraStorybookIsStepCall(
      muirMoiraStorybookAwaited(muirMoiraStorybookField(cut, 'expression')),
    ) && holdsAnInteractionOutsideBranches(cut)
      ? { by: 'step' }
      : { by: 'maybe' };
  }

  const statements = muirMoiraStorybookList(tree.listOf(read.node));

  return {
    by: 'interaction',
    node: cut,
    sameList: tree.listOf(cut) === statements,
    adjacent: statements[statements.indexOf(read.node) + 1] === cut,
    sameTarget:
      muirMoiraStorybookTargetOf(read) !== undefined &&
      muirMoiraStorybookEquivalent(
        muirMoiraStorybookTargetOf(read),
        muirMoiraStorybookTargetOf(ending),
      ),
  };
}

const waitCalls: ReadonlyMap<unknown, 'waitFor' | 'removal'> = new Map([
  ['waitFor', 'waitFor'],
  ['waitForElementToBeRemoved', 'removal'],
]);

/** `'waitFor'` for a `waitFor(...)` call, `'removal'` for a `waitForElementToBeRemoved(...)` call, given as a statement, awaited or plain; `undefined` for anything else. */
export function muirMoiraStorybookWaitCall(
  node: unknown,
): 'waitFor' | 'removal' | undefined {
  const call = muirMoiraStorybookAwaited(
    muirMoiraStorybookField(node, 'type') === 'ExpressionStatement'
      ? muirMoiraStorybookField(node, 'expression')
      : node,
  );

  return muirMoiraStorybookField(call, 'type') === 'CallExpression'
    ? waitCalls.get(muirMoiraStorybookField(call, 'callee', 'name'))
    : undefined;
}

/** `step(...)`, or `<context>.step(...)` or `<context>?.step(...)` on a play context that is not destructured. */
export function muirMoiraStorybookIsStepCall(node: unknown): boolean {
  const callee = muirMoiraStorybookField(node, 'callee');

  return (
    muirMoiraStorybookIsCall(node) &&
    (muirMoiraStorybookField(callee, 'name') === 'step' ||
      (muirMoiraStorybookIsMember(callee) &&
        muirMoiraStorybookField(callee, 'object', 'type') === 'Identifier' &&
        muirMoiraStorybookMemberName(callee) === 'step'))
  );
}
