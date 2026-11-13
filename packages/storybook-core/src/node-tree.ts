import { unwrap } from './csf-nodes.ts';
import { isRecord } from './is-record.ts';
import { field, list } from './node-field.ts';

export interface TreeIndex {
  readonly parentOf: (node: unknown) => unknown;
  readonly listOf: (node: unknown) => readonly unknown[] | undefined;
}

/** The keys of a Babel node that hold no child node: positions, comments and parser extras. */
const positionKeys: ReadonlySet<string> = new Set([
  'loc',
  'start',
  'end',
  'range',
  'extra',
  'comments',
  'leadingComments',
  'trailingComments',
  'innerComments',
]);

type Node = Readonly<Record<string, unknown>>;

export function isNode(value: unknown): value is Node {
  return isRecord(value) && typeof value['type'] === 'string';
}

const functionTypes: readonly unknown[] = [
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ObjectMethod',
  'ClassMethod',
  'ClassPrivateMethod',
];

export function isFunction(node: unknown): boolean {
  return functionTypes.includes(field(node, 'type'));
}

/** The child nodes of `node`, in source order for each key. */
export function childNodes(node: unknown): readonly Node[] {
  return isNode(node)
    ? Object.entries(node)
        .filter(([key]) => !positionKeys.has(key))
        .flatMap(([, value]) => (Array.isArray(value) ? list(value) : [value]))
        .filter(isNode)
    : [];
}

/** `node` and every node below it, outer before inner and in source order for each key. */
export function descendants(node: unknown): readonly unknown[] {
  return [node, ...childNodes(node).flatMap(descendants)];
}

/** The expression inside `await` and the type wrappers around either. */
export function awaited(expression: unknown): unknown {
  const inner = unwrap(expression);

  return unwrap(
    field(inner, 'type') === 'AwaitExpression'
      ? field(inner, 'argument')
      : inner,
  );
}

/** The name a member reads: its identifier, or its string-literal key when computed; `undefined` for any other key. */
export function memberName(member: unknown): string | undefined {
  const property = field(member, 'property');
  const name =
    field(member, 'computed') === true
      ? field(property, 'type') === 'StringLiteral'
        ? field(property, 'value')
        : undefined
      : field(property, 'type') === 'Identifier'
        ? field(property, 'name')
        : undefined;

  return typeof name === 'string' ? name : undefined;
}

/** Babel's `isNodesEquivalent` over plain nodes: the same type and fields, whatever the positions, comments and `extra`. */
export function equivalent(first: unknown, second: unknown): boolean {
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

/** `node` and every object below it, positions included. */
export function nodesIn(node: object): readonly unknown[] {
  return [node, ...Object.values(node).filter(isRecord).flatMap(nodesIn)];
}

/** The specifier of `import(<specifier>)`, an `ImportExpression` as Babel 8 parses it, or a call with an `Import` callee as Babel 7 does by default. */
export function importSourceOf(node: unknown): unknown {
  return field(node, 'type') === 'ImportExpression'
    ? field(node, 'source')
    : field(node, 'callee', 'type') === 'Import'
      ? list(field(node, 'arguments'))[0]
      : undefined;
}

/** The key that holds each statement-list node's statements. */
const statementLists: ReadonlyMap<unknown, string> = new Map([
  ['Program', 'body'],
  ['BlockStatement', 'body'],
  ['StaticBlock', 'body'],
  ['TSModuleBlock', 'body'],
  ['SwitchCase', 'consequent'],
]);

/** The parent of every node of `program`, and the statement list each statement stands in, copied when it is indexed so that a later change to the tree, such as a placed mutant, reads the file as written. */
export function indexTree(program: unknown): TreeIndex {
  const parents = new WeakMap<object, unknown>();
  const lists = new WeakMap<object, readonly unknown[]>();
  const visit = (node: unknown): void => {
    const statements = list(
      field(node, statementLists.get(field(node, 'type')) ?? ''),
    );
    const snapshot = [...statements];

    statements
      .filter(isRecord)
      .forEach((statement) => lists.set(statement, snapshot));
    childNodes(node).forEach((child) => {
      parents.set(child, node);
      visit(child);
    });
  };

  visit(program);

  return {
    parentOf: (node) => (isRecord(node) ? parents.get(node) : undefined),
    listOf: (node) => (isRecord(node) ? lists.get(node) : undefined),
  };
}
