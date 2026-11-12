import { field, isRecord, list, unwrap } from '@layzee/storybook-core';
import type { schema } from '@stryker-mutator/api/core';

export const interactionShapes = [
  'negative-only',
  'click-before-type',
  'cleared-later',
] as const;

export type InteractionShape = (typeof interactionShapes)[number];

type AstNode = Readonly<Record<string, unknown>>;

/** A node with its ancestors, parent first, and the statement list that holds it, when one does. */
interface Located {
  readonly node: AstNode;
  readonly ancestors: readonly AstNode[];
  readonly statements: readonly AstNode[] | undefined;
}

/** The nodes of one file, and which of them are interactions. */
interface InteractionIndex {
  readonly located: ReadonlyMap<AstNode, Located>;
  readonly isSite: (node: AstNode) => boolean;
}

/**
 * The shapes of the interactions in `program` whose report ranges are `sites`: for a site, every shape that holds, or
 * `undefined` when no node of `program` has its range.
 */
export function interactionShapeReader(
  program: unknown,
  sites: readonly schema.Location[],
): (site: schema.Location) => readonly InteractionShape[] | undefined {
  const located = locate(program);
  const siteKeys = new Set(sites.map(locationKey));
  const isSite = (node: AstNode): boolean => {
    const key = rangeKey(node);

    return key !== undefined && siteKeys.has(key);
  };
  const index: InteractionIndex = { located, isSite };
  const siteNodes = new Map<string, Located>();
  located.forEach((entry) => {
    const key = rangeKey(entry.node);

    if (key !== undefined && siteKeys.has(key) && !siteNodes.has(key)) {
      siteNodes.set(key, entry);
    }
  });

  return (site) => {
    const entry = siteNodes.get(locationKey(site));

    return entry === undefined
      ? undefined
      : interactionShapes.filter((shape) => hasShape[shape](entry, index));
  };
}

const hasShape: Readonly<
  Record<InteractionShape, (site: Located, index: InteractionIndex) => boolean>
> = {
  'negative-only': isNegativeOnly,
  'click-before-type': isClickBeforeType,
  'cleared-later': isClearedLater,
};

/**
 * At least one check before the next statement that holds an interaction, and every check before the next interaction
 * negative; both are looked for past the end of the interaction's block and of a step callback that holds it.
 */
function isNegativeOnly(site: Located, index: InteractionIndex): boolean {
  const later = laterStatements(site, index.located);
  const holds = (statement: AstNode): boolean =>
    holdsInteraction(statement, index.isSite);
  const isNext = (statement: AstNode): boolean =>
    index.isSite(statement) ||
    (isStepCall(awaited(field(statement, 'expression'))) && holds(statement));

  return (
    statementsBefore(later, holds).some(
      (statement) => checksIn(statement).length > 0,
    ) &&
    statementsBefore(later, isNext)
      .flatMap(checksIn)
      .every((chain) => chain.includes('not'))
  );
}

/** A click or hover directly before a user-event 14 `type` of an equivalent target that keeps the click. */
function isClickBeforeType(site: Located, index: InteractionIndex): boolean {
  const current = callOf(site.node);
  const [next] = nextSiblings(site);
  const nextSite =
    next !== undefined && index.isSite(next)
      ? index.located.get(next)
      : undefined;

  if (current === undefined || nextSite === undefined) {
    return false;
  }

  const following = callOf(nextSite.node);

  return (
    following !== undefined &&
    ['click', 'hover'].includes(current.method ?? '') &&
    rootName(current.receiver) !== 'fireEvent' &&
    following.method === 'type' &&
    actsOnSameTarget(current, following) &&
    !maySkipClick(following.args[2]) &&
    isUserEvent14(following.receiver, nextSite.ancestors)
  );
}

/**
 * A `type` or `clear` with no check before the next statement in its own block that holds an interaction, when that
 * statement is a `clear` of an equivalent target.
 */
function isClearedLater(site: Located, index: InteractionIndex): boolean {
  const current = callOf(site.node);
  const siblings = nextSiblings(site);
  const between = statementsBefore(siblings, (statement) =>
    holdsInteraction(statement, index.isSite),
  );
  const end = siblings[between.length];
  const later =
    end !== undefined && index.isSite(end) ? callOf(end) : undefined;

  return (
    current !== undefined &&
    later !== undefined &&
    ['type', 'clear'].includes(current.method ?? '') &&
    later.method === 'clear' &&
    actsOnSameTarget(current, later) &&
    between.every((statement) => checksIn(statement).length === 0)
  );
}

/** The call of an interaction site: the statement's expression or the step body, without `await` or type wrappers. */
interface InteractionCall {
  /** The callee's property name for `<receiver>.<method>(...)`. */
  readonly method: string | undefined;
  readonly receiver: unknown;
  readonly args: readonly unknown[];
}

function callOf(node: AstNode): InteractionCall | undefined {
  const call = awaited(
    node['type'] === 'ExpressionStatement' ? node['expression'] : node,
  );
  const callee = unwrap(field(call, 'callee'));
  const onMember = isMember(callee);

  return callTypes.has(field(call, 'type'))
    ? {
        method: onMember ? nameOf(field(callee, 'property')) : undefined,
        receiver: onMember ? unwrap(field(callee, 'object')) : undefined,
        args: list(field(call, 'arguments')),
      }
    : undefined;
}

const callTypes: ReadonlySet<unknown> = new Set([
  'CallExpression',
  'OptionalCallExpression',
]);

const memberTypes: ReadonlySet<unknown> = new Set([
  'MemberExpression',
  'OptionalMemberExpression',
]);

function isMember(node: unknown): boolean {
  return memberTypes.has(field(node, 'type'));
}

/** The identifier a member chain such as `user.keyboard` starts at. */
function rootName(node: unknown): string | undefined {
  return isMember(node)
    ? rootName(unwrap(field(node, 'object')))
    : nameOf(node);
}

function actsOnSameTarget(
  first: InteractionCall,
  second: InteractionCall,
): boolean {
  return (
    first.args[0] !== undefined && equivalent(first.args[0], second.args[0])
  );
}

/** Babel's `isNodesEquivalent` over plain nodes: the same type and fields, whatever the positions, comments and `extra`. */
function equivalent(first: unknown, second: unknown): boolean {
  if (Array.isArray(first) || Array.isArray(second)) {
    return (
      Array.isArray(first) &&
      Array.isArray(second) &&
      first.length === second.length &&
      first.every((item: unknown, at) => equivalent(item, second[at]))
    );
  }

  if (!isNode(first) || !isNode(second)) {
    return first === second;
  }

  const keys = new Set(
    [...Object.keys(first), ...Object.keys(second)].filter(
      (key) => !positionKeys.has(key),
    ),
  );

  return [...keys].every((key) => equivalent(first[key], second[key]));
}

/**
 * Unless the options are absent, or an object literal with no spread, computed key or `__proto__` whose `skipClick` is
 * absent or `false`.
 */
function maySkipClick(options: unknown): boolean {
  if (options !== undefined && field(options, 'type') !== 'ObjectExpression') {
    return true;
  }

  return list(field(options, 'properties')).some(
    (property) =>
      field(property, 'type') === 'SpreadElement' ||
      field(property, 'computed') === true ||
      keyName(property) === '__proto__' ||
      (keyName(property) === 'skipClick' &&
        !(
          field(property, 'value', 'type') === 'BooleanLiteral' &&
          field(property, 'value', 'value') === false
        )),
  );
}

/** The name of a property's identifier or string-literal key, when it is not computed. */
function keyName(property: unknown): unknown {
  return field(property, 'computed') === true
    ? undefined
    : (nameOf(field(property, 'key')) ?? field(property, 'key', 'value'));
}

/**
 * Whether `receiver` names a `userEvent` destructured from the first parameter of a `play` function, the play
 * context's, or imported from `storybook/test`: both are user-event 14.
 */
function isUserEvent14(
  receiver: unknown,
  ancestors: readonly AstNode[],
): boolean {
  const name = nameOf(receiver);
  const declaration =
    name === undefined ? undefined : declarationOf(name, ancestors);

  return (
    (isPlayContext(declaration, ancestors) &&
      list(field(declaration, 'properties')).some(
        (property) =>
          nameOf(field(property, 'key')) === 'userEvent' &&
          nameOf(field(property, 'value')) === name,
      )) ||
    (field(declaration, 'source', 'value') === 'storybook/test' &&
      list(field(declaration, 'specifiers')).some(
        (specifier) =>
          nameOf(field(specifier, 'imported')) === 'userEvent' &&
          nameOf(field(specifier, 'local')) === name,
      ))
  );
}

/** Whether `parameter` is the first parameter of a function that is the `play` property of the meta or a story. */
function isPlayContext(
  parameter: AstNode | undefined,
  ancestors: readonly AstNode[],
): boolean {
  const owner = ancestors.findIndex(
    (ancestor) =>
      isFunction(ancestor) && list(ancestor['params'])[0] === parameter,
  );
  // A story is `export const <name> = { ... }`: declarator, declaration, export.
  const [property, object, holder, , exported] = ancestors.slice(owner + 1);

  return (
    owner !== -1 &&
    keyName(property) === 'play' &&
    (field(holder, 'type') === 'ExportDefaultDeclaration' ||
      (field(holder, 'init') === object &&
        field(exported, 'type') === 'ExportNamedDeclaration'))
  );
}

/**
 * The parameter or statement nearest to a node with these ancestors that declares `name`, a `for` head, a `catch`
 * parameter and the statements of every case of a `switch`, one scope, included.
 */
function declarationOf(
  name: string,
  ancestors: readonly AstNode[],
): AstNode | undefined {
  return ancestors
    .flatMap((ancestor) => [
      ...list(isFunction(ancestor) ? ancestor['params'] : ancestor['body']),
      ancestor['left'],
      ancestor['init'],
      ancestor['param'],
      ...list(ancestor['cases']).flatMap((switchCase) =>
        list(field(switchCase, 'consequent')),
      ),
    ])
    .filter(isNode)
    .find((declaration) => declares(declaration, name));
}

/** The keys under which a declaration or pattern of each type holds the names it binds. */
const bindingKeys: Readonly<Record<string, readonly string[]>> = {
  ImportDeclaration: ['specifiers'],
  ImportSpecifier: ['local'],
  VariableDeclaration: ['declarations'],
  VariableDeclarator: ['id'],
  FunctionDeclaration: ['id'],
  ClassDeclaration: ['id'],
  ObjectPattern: ['properties'],
  ObjectProperty: ['value'],
  ArrayPattern: ['elements'],
  RestElement: ['argument'],
  AssignmentPattern: ['left'],
};

function declares(node: unknown, name: string): boolean {
  const type = field(node, 'type');
  const keys = typeof type === 'string' ? (bindingKeys[type] ?? []) : [];

  return (
    nameOf(node) === name ||
    keys.some((key) => {
      const value = field(node, key);

      return list(Array.isArray(value) ? value : [value]).some((child) =>
        declares(child, name),
      );
    })
  );
}

/** The statements that run after `site` in its function, and after the step call when that function is a step callback. */
function laterStatements(
  site: Located,
  located: ReadonlyMap<AstNode, Located>,
): readonly AstNode[] {
  const outer = continuationOf(site, located);

  return [
    ...nextSiblings(site),
    ...(outer === undefined ? [] : laterStatements(outer, located)),
  ];
}

/** Where the statements after `node` go on: its parent, or the step call around a step callback; none past another function. */
function continuationOf(
  { ancestors: [parent, grandparent] }: Located,
  located: ReadonlyMap<AstNode, Located>,
): Located | undefined {
  if (parent === undefined) {
    return undefined;
  }

  if (!isFunction(parent)) {
    return located.get(parent);
  }

  return grandparent !== undefined && isStepCall(grandparent)
    ? located.get(grandparent)
    : undefined;
}

function nextSiblings({ node, statements }: Located): readonly AstNode[] {
  return statements === undefined
    ? []
    : statements.slice(statements.indexOf(node) + 1);
}

/** The statements before the first one among them that `ends`. */
function statementsBefore(
  statements: readonly AstNode[],
  ends: (statement: AstNode) => boolean,
): readonly AstNode[] {
  const end = statements.findIndex(ends);

  return end === -1 ? statements : statements.slice(0, end);
}

/**
 * Whether `statement` is or holds an interaction that runs within it: outside a step callback only step and `waitFor`
 * callbacks are entered, inside one every function is.
 */
function holdsInteraction(
  statement: AstNode,
  isSite: (node: AstNode) => boolean,
): boolean {
  const holds = (node: AstNode, insideStep: boolean): boolean =>
    isSite(node) ||
    childEntries(node).some(([key, value]) =>
      list(Array.isArray(value) ? value : [value])
        .filter(isNode)
        .some((child) => {
          const isArgument = key === 'arguments';
          const entersStep = isArgument && isStepCall(node);
          const runsHere =
            insideStep ||
            !isFunction(child) ||
            entersStep ||
            (isArgument && nameOf(node['callee']) === 'waitFor');

          return runsHere && holds(child, insideStep || entersStep);
        }),
    );

  return holds(statement, false);
}

/** `step(...)`, or `<context>.step(...)` on a play context that is not destructured. */
function isStepCall(node: unknown): boolean {
  const callee = field(node, 'callee');

  return (
    field(node, 'type') === 'CallExpression' &&
    (nameOf(callee) === 'step' ||
      (field(callee, 'type') === 'MemberExpression' &&
        nameOf(field(callee, 'object')) !== undefined &&
        nameOf(field(callee, 'property')) === 'step'))
  );
}

/** The expression without `await` and the type wrappers around it. */
function awaited(expression: unknown): unknown {
  const inner = unwrap(expression);

  return unwrap(
    field(inner, 'type') === 'AwaitExpression'
      ? field(inner, 'argument')
      : inner,
  );
}

const functionTypes: ReadonlySet<unknown> = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
  'ObjectMethod',
  'ClassMethod',
  'ClassPrivateMethod',
]);

function isFunction(node: AstNode): boolean {
  return functionTypes.has(node['type']);
}

/** The member names after each check call in `node`, nearest first, from the outermost chain around it. */
function checksIn(node: unknown): readonly (readonly string[])[] {
  const checks = new Map<AstNode, readonly string[]>();
  const visit = (current: unknown): void => {
    if (!isNode(current)) {
      return;
    }

    const check = chainTo(current, []);

    if (check !== undefined && !checks.has(check.call)) {
      checks.set(check.call, check.names);
    }

    childEntries(current).forEach(([, value]) =>
      (Array.isArray(value) ? value : [value]).forEach(visit),
    );
  };

  visit(node);

  return [...checks.values()];
}

/** A check call and the member names after it. */
interface CheckChain {
  readonly call: AstNode;
  readonly names: readonly string[];
}

function chainTo(
  node: unknown,
  names: readonly string[],
): CheckChain | undefined {
  if (!isNode(node)) {
    return undefined;
  }

  if (node['type'] === 'CallExpression') {
    return isCheckCall(node)
      ? { call: node, names }
      : chainTo(node['callee'], names);
  }

  return node['type'] === 'MemberExpression'
    ? chainTo(node['object'], [nameOf(node['property']) ?? '', ...names])
    : undefined;
}

/**
 * `expect(...)`, `expect.<name>(...)` such as `expect.soft`, `expect.element` or `expect.poll`, or a query that fails
 * when it finds nothing.
 */
function isCheckCall(call: AstNode): boolean {
  const callee = call['callee'];

  return (
    nameOf(callee) === 'expect' ||
    nameOf(field(callee, 'object')) === 'expect' ||
    failingQuery.test(nameOf(callee) ?? nameOf(field(callee, 'property')) ?? '')
  );
}

/** `findBy*`, `findAllBy*`, `getBy*` and `getAllBy*`, on any receiver or none; `queryBy*` finds nothing quietly. */
const failingQuery = /^(find|get)(All)?By/;

function nameOf(node: unknown): string | undefined {
  const name = field(node, 'name');

  return field(node, 'type') === 'Identifier' && typeof name === 'string'
    ? name
    : undefined;
}

function isNode(value: unknown): value is AstNode {
  return isRecord(value) && typeof value['type'] === 'string';
}

const positionKeys: ReadonlySet<string> = new Set([
  'loc',
  'start',
  'end',
  'extra',
  'leadingComments',
  'trailingComments',
  'innerComments',
]);

const statementLists: ReadonlySet<string> = new Set(['body', 'consequent']);

/** Every node of `program` in source order, outer before inner. */
function locate(program: unknown): ReadonlyMap<AstNode, Located> {
  const located = new Map<AstNode, Located>();
  const visit = (
    node: AstNode,
    ancestors: readonly AstNode[],
    statements: readonly AstNode[] | undefined,
  ): void => {
    located.set(node, { node, ancestors, statements });
    childEntries(node).forEach(([key, value]) => {
      const children = list(value).filter(isNode);

      if (Array.isArray(value)) {
        children.forEach((child) =>
          visit(
            child,
            [node, ...ancestors],
            statementLists.has(key) ? children : undefined,
          ),
        );
      } else if (isNode(value)) {
        visit(value, [node, ...ancestors], undefined);
      }
    });
  };

  if (isNode(program)) {
    visit(program, [], undefined);
  }

  return located;
}

function childEntries(node: AstNode): readonly (readonly [string, unknown])[] {
  return Object.entries(node).filter(([key]) => !positionKeys.has(key));
}

/** The report's 1-based range of a Babel node, whose columns are 0-based; `undefined` for a node with no `loc`. */
function rangeKey(node: AstNode): string | undefined {
  const start = field(node, 'loc', 'start');
  const end = field(node, 'loc', 'end');
  const startLine = field(start, 'line');
  const startColumn = field(start, 'column');
  const endLine = field(end, 'line');
  const endColumn = field(end, 'column');

  return typeof startLine === 'number' &&
    typeof startColumn === 'number' &&
    typeof endLine === 'number' &&
    typeof endColumn === 'number'
    ? locationKey({
        start: { line: startLine, column: startColumn + 1 },
        end: { line: endLine, column: endColumn + 1 },
      })
    : undefined;
}

function locationKey({ start, end }: schema.Location): string {
  return [start.line, start.column, end.line, end.column].join(':');
}
