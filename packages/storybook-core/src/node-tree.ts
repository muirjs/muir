import { unwrap } from './csf-nodes.ts';
import { isRecord } from './is-record.ts';
import { field, list } from './node-field.ts';

export interface TreeIndex {
  readonly parentOf: (node: unknown) => unknown;
  /** The parent of `node`, its parent, and so on up to the Program. */
  readonly ancestors: (node: unknown) => readonly unknown[];
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
  const found: unknown[] = [];
  const visit = (each: unknown): void => {
    found.push(each);
    childNodes(each).forEach(visit);
  };

  visit(node);

  return found;
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
  const type = field(property, 'type');

  if (field(member, 'computed') === true) {
    return type === 'StringLiteral' ? stringIn(property, 'value') : undefined;
  }

  return type === 'Identifier' ? stringIn(property, 'name') : undefined;
}

function stringIn(node: unknown, key: string): string | undefined {
  const value = field(node, key);

  return typeof value === 'string' ? value : undefined;
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

/**
 * An id for `root` and each node below it: two of them share an id exactly when `equivalent` holds between them. Ids
 * are built from the leaves up, each from the node's own fields and its children's ids, so none repeats the text
 * below it.
 */
export function equivalenceIds(root: unknown): ReadonlyMap<unknown, string> {
  const ids = new Map<unknown, string>();
  const interned = new Map<string, string>();
  const identities = new Map<unknown, string>();
  let count = 0;
  const fresh = (): string => `o${count++}`;
  const intern = (signature: string): string => {
    const known = interned.get(signature) ?? `#${count++}`;

    interned.set(signature, known);

    return known;
  };
  /** A token for a field's value that matches another exactly when `equivalent` holds between the two values. */
  const tokenOf = (value: unknown): string => {
    if (Array.isArray(value)) {
      return intern(`[${value.map(tokenOf).join(',')}]`);
    }

    if (isNode(value)) {
      return ids.get(value) ?? fresh();
    }

    if (typeof value === 'string') {
      return JSON.stringify(value);
    }

    if (typeof value === 'number') {
      return Number.isNaN(value) ? fresh() : `n${value}`;
    }

    if (
      typeof value === 'boolean' ||
      typeof value === 'bigint' ||
      value === undefined ||
      value === null
    ) {
      return String(value) + typeof value;
    }

    // Any other object, a function or a symbol: `equivalent` compares it by identity.
    const known = identities.get(value) ?? fresh();

    identities.set(value, known);

    return known;
  };

  [...descendants(root)].reverse().forEach((node) => {
    if (!isNode(node)) {
      return;
    }

    const fields = Object.keys(node)
      .filter((key) => !positionKeys.has(key) && node[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${tokenOf(node[key])}`);

    ids.set(node, intern(`{${fields.join(',')}}`));
  });

  return ids;
}

/** `node` and every object below it, positions included; `descendants` gives only child nodes. */
export function everyRecordIn(node: object): readonly unknown[] {
  return [node, ...Object.values(node).filter(isRecord).flatMap(everyRecordIn)];
}

/** The specifier of `import(<specifier>)`, an `ImportExpression` as Babel 8 parses it, or a call with an `Import` callee as Babel 7 does by default. */
export function importSourceOf(node: unknown): unknown {
  if (field(node, 'type') === 'ImportExpression') {
    return field(node, 'source');
  }

  return field(node, 'callee', 'type') === 'Import'
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

  const parentOf = (node: unknown): unknown =>
    isRecord(node) ? parents.get(node) : undefined;

  return {
    parentOf,
    ancestors: (node) => {
      const found: unknown[] = [];

      for (let at = parentOf(node); at !== undefined; at = parentOf(at)) {
        found.push(at);
      }

      return found;
    },
    listOf: (node) => (isRecord(node) ? lists.get(node) : undefined),
  };
}
