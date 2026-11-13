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

/** The child nodes of `node`, in source order for each key. */
export function childNodes(node: unknown): readonly Node[] {
  return isNode(node)
    ? Object.entries(node)
        .filter(([key]) => !positionKeys.has(key))
        .flatMap(([, value]) => (Array.isArray(value) ? list(value) : [value]))
        .filter(isNode)
    : [];
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
