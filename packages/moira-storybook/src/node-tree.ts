import { muirMoiraStorybookUnwrap } from './csf-nodes.ts';
import { muirMoiraStorybookIsRecord } from './is-record.ts';
import {
  muirMoiraStorybookField,
  muirMoiraStorybookList,
} from './node-field.ts';

export interface MuirMoiraStorybookTreeIndex {
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
  'leadingComments',
  'trailingComments',
  'innerComments',
]);

type Node = Readonly<Record<string, unknown>>;

export function muirMoiraStorybookIsNode(value: unknown): value is Node {
  return muirMoiraStorybookIsRecord(value) && typeof value['type'] === 'string';
}

const functionTypes: readonly unknown[] = [
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ObjectMethod',
  'ClassMethod',
  'ClassPrivateMethod',
];

export function muirMoiraStorybookIsFunction(node: unknown): boolean {
  return functionTypes.includes(muirMoiraStorybookField(node, 'type'));
}

/** The child nodes of `node`, in source order for each key. */
export function muirMoiraStorybookChildNodes(node: unknown): readonly Node[] {
  return muirMoiraStorybookIsNode(node)
    ? Object.entries(node)
        .filter(([key]) => !positionKeys.has(key))
        .flatMap(([, value]) =>
          Array.isArray(value) ? muirMoiraStorybookList(value) : [value],
        )
        .filter(muirMoiraStorybookIsNode)
    : [];
}

/** `node` and every node below it, outer before inner and in source order for each key. */
export function muirMoiraStorybookDescendants(
  node: unknown,
): readonly unknown[] {
  const found: unknown[] = [];
  const visit = (each: unknown): void => {
    found.push(each);
    muirMoiraStorybookChildNodes(each).forEach(visit);
  };

  visit(node);

  return found;
}

/** The expression inside `await` and the type wrappers around either. */
export function muirMoiraStorybookAwaited(expression: unknown): unknown {
  const inner = muirMoiraStorybookUnwrap(expression);

  return muirMoiraStorybookUnwrap(
    muirMoiraStorybookField(inner, 'type') === 'AwaitExpression'
      ? muirMoiraStorybookField(inner, 'argument')
      : inner,
  );
}

/** The name a member reads: its identifier, or its string-literal key when computed; `undefined` for any other key. */
export function muirMoiraStorybookMemberName(
  member: unknown,
): string | undefined {
  const property = muirMoiraStorybookField(member, 'property');
  const type = muirMoiraStorybookField(property, 'type');

  if (muirMoiraStorybookField(member, 'computed') === true) {
    return type === 'StringLiteral' ? stringIn(property, 'value') : undefined;
  }

  return type === 'Identifier' ? stringIn(property, 'name') : undefined;
}

function stringIn(node: unknown, key: string): string | undefined {
  const value = muirMoiraStorybookField(node, key);

  return typeof value === 'string' ? value : undefined;
}

/** Babel's `isNodesEquivalent` over plain nodes: the same type and fields, whatever the positions, comments and `extra`. */
export function muirMoiraStorybookEquivalent(
  first: unknown,
  second: unknown,
): boolean {
  const tokenOf = muirMoiraStorybookEquivalenceTokens([first, second]);

  return tokenOf(first) === tokenOf(second);
}

/**
 * Tokens for the values in and below `roots`, for a Babel tree: two values share a token exactly when they are
 * `equivalent`. A node's token is built from the leaves up, from its fields other than positions, so none repeats
 * the text below it; an array's from its items; a plain object's, such as a template element's `value`, from its
 * fields compared with `===`; any other object's from its identity. A node outside `roots` gets a fresh token at each
 * call, which no other value shares.
 */
export function muirMoiraStorybookEquivalenceTokens(
  roots: readonly unknown[],
): (value: unknown) => string {
  const nodeTokens = new Map<unknown, string>();
  const interned = new Map<string, string>();
  const identities = new Map<unknown, string>();
  let count = 0;
  const fresh = (): string => `o${count++}`;
  const intern = (signature: string): string => {
    const known = interned.get(signature);

    if (known !== undefined) {
      return known;
    }

    const id = `#${count++}`;

    interned.set(signature, id);

    return id;
  };
  const tokenOf = (value: unknown): string => {
    if (Array.isArray(value)) {
      return intern(`[${value.map(tokenOf).join()}]`);
    }

    if (muirMoiraStorybookIsNode(value)) {
      return nodeTokens.get(value) ?? fresh();
    }

    if (muirMoiraStorybookIsRecord(value)) {
      const fields = Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${shallowTokenOf(value[key])}`);

      return intern(`(${fields.join()})`);
    }

    return shallowTokenOf(value);
  };
  /** A token for a value that `equivalent` compares with `===`. */
  const shallowTokenOf = (value: unknown): string => {
    if (Number.isNaN(value)) {
      return fresh();
    }

    // A Map compares a primitive by its value and anything else by identity, as `===` does but for NaN.
    const known = identities.get(value) ?? fresh();

    identities.set(value, known);

    return known;
  };

  roots
    .flat()
    .flatMap(muirMoiraStorybookDescendants)
    .reverse()
    .forEach((node) => {
      if (!muirMoiraStorybookIsNode(node)) {
        return;
      }

      const fields = Object.keys(node)
        .filter((key) => !positionKeys.has(key) && node[key] !== undefined)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${tokenOf(node[key])}`);

      nodeTokens.set(node, intern(`{${fields.join()}}`));
    });

  return tokenOf;
}

/** `node` and every object below it, positions included; `descendants` gives only child nodes. */
export function muirMoiraStorybookEveryRecordIn(
  node: object,
): readonly unknown[] {
  return [
    node,
    ...Object.values(node)
      .filter(muirMoiraStorybookIsRecord)
      .flatMap(muirMoiraStorybookEveryRecordIn),
  ];
}

/** The specifier of `import(<specifier>)`, an `ImportExpression` as Babel 8 parses it, or a call with an `Import` callee as Babel 7 does by default. */
export function muirMoiraStorybookImportSourceOf(node: unknown): unknown {
  if (muirMoiraStorybookField(node, 'type') === 'ImportExpression') {
    return muirMoiraStorybookField(node, 'source');
  }

  return muirMoiraStorybookField(node, 'callee', 'type') === 'Import'
    ? muirMoiraStorybookList(muirMoiraStorybookField(node, 'arguments'))[0]
    : undefined;
}

const moduleDeclarations: ReadonlySet<unknown> = new Set([
  'ImportDeclaration',
  'ExportNamedDeclaration',
  'ExportAllDeclaration',
]);

/** The specifier of the module `node` loads: an `import` or `export ... from` declaration, an `import()` or a `require()`. */
export function muirMoiraStorybookLoadedSpecifierOf(node: unknown): unknown {
  if (moduleDeclarations.has(muirMoiraStorybookField(node, 'type'))) {
    // An `export const` declaration has a null source: it loads nothing.
    return muirMoiraStorybookField(node, 'source') ?? undefined;
  }

  return (
    muirMoiraStorybookImportSourceOf(node) ??
    (muirMoiraStorybookField(node, 'callee', 'name') === 'require'
      ? muirMoiraStorybookList(muirMoiraStorybookField(node, 'arguments'))[0]
      : undefined)
  );
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
export function muirMoiraStorybookIndexTree(
  program: unknown,
): MuirMoiraStorybookTreeIndex {
  const parents = new WeakMap<object, unknown>();
  const lists = new WeakMap<object, readonly unknown[]>();
  const visit = (node: unknown): void => {
    const listKey = statementLists.get(muirMoiraStorybookField(node, 'type'));
    const statements = muirMoiraStorybookList(
      // Stryker disable next-line StringLiteral: no Babel node has a field named '' or the mutant's text, so both read no list
      muirMoiraStorybookField(node, listKey ?? ''),
    );
    const snapshot = [...statements];

    statements
      .filter(muirMoiraStorybookIsRecord)
      .forEach((statement) => lists.set(statement, snapshot));
    muirMoiraStorybookChildNodes(node).forEach((child) => {
      parents.set(child, node);
      visit(child);
    });
  };

  visit(program);

  const parentOf = (node: unknown): unknown =>
    muirMoiraStorybookIsRecord(node) ? parents.get(node) : undefined;

  return {
    parentOf,
    ancestors: (node) => {
      const found: unknown[] = [];

      for (let at = parentOf(node); at !== undefined; at = parentOf(at)) {
        found.push(at);
      }

      return found;
    },
    listOf: (node) =>
      muirMoiraStorybookIsRecord(node) ? lists.get(node) : undefined,
  };
}
