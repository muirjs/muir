import { isMember, unwrap } from './csf-nodes.ts';
import { isRecord, isStringArray } from './is-record.ts';
import { field, list } from './node-field.ts';
import { childNodes, isFunction } from './node-tree.ts';

type BindingKind =
  | 'var'
  | 'let'
  | 'const'
  | 'param'
  | 'function'
  | 'class'
  | 'import';

export interface Binding {
  readonly kind: BindingKind;
  readonly identifier: unknown;
  /** The node that declares it: a variable declarator, an import specifier, a function, a class, a catch clause, or a parameter as the function lists it. */
  readonly declaration: unknown;
  /** The nodes that give the binding another value after its declaration. */
  readonly writes: readonly unknown[];
}

export interface FileScope {
  /** The binding an identifier declares, reads or writes; `undefined` when the file binds no such name in reach. */
  readonly bindingOf: (identifier: unknown) => Binding | undefined;
  /** The identifiers in `node` that read or write a binding, in source order. */
  readonly referencesIn: (node: unknown) => readonly unknown[];
  /** The members a write targets, such as `a.b` in `a.b = c`, `[a.b] = c` or `for (a.b of c)`. */
  readonly writtenMembers: readonly unknown[];
}

type DeclaredBinding = Omit<Binding, 'writes'>;

interface Scope {
  readonly parent: Scope | undefined;
  /** A function's scope, where a `var` is bound; a `var` that meets no such scope is bound in the Program's. */
  readonly holdsVar: boolean;
  readonly bindings: Map<string, DeclaredBinding>;
}

/** What one declaration binds its names as: their kind, the scope that holds them, the scope its defaults and computed keys are read in, and the node a second declaration of a name writes it by. */
interface Declaration {
  readonly kind: BindingKind;
  readonly scope: Scope;
  readonly readScope: Scope;
  readonly node: unknown;
}

/** The nodes that open a block scope over all they hold. A function's own body block is its body scope, below the scope of its parameters and `var`s; a class static block also holds its `var`s. */
const blockScopes: readonly unknown[] = [
  'BlockStatement',
  'ForStatement',
  'StaticBlock',
];

/** The keys under which a node of each type holds an identifier that reads and writes no binding, such as a label. */
const nameKeys: ReadonlyMap<unknown, readonly string[]> = new Map([
  ['LabeledStatement', ['label']],
  ['BreakStatement', ['label']],
  ['ContinueStatement', ['label']],
  ['ExportSpecifier', ['exported']],
  ['MetaProperty', ['meta', 'property']],
  ['PrivateName', ['id']],
  ['ClassExpression', ['id']],
  ['ClassDeclaration', ['id']],
  ['TSDeclareMethod', ['params']],
]);

/** The keys under which a node of each type holds a name that reads no binding unless the node is computed: a member's property, a property's, class field's or overload signature's key. A method's key is read where functions are, and a private key is a `PrivateName`, which reads nothing. */
const keyNames: ReadonlyMap<unknown, readonly string[]> = new Map([
  ['MemberExpression', ['property']],
  ['OptionalMemberExpression', ['property']],
  ['ObjectProperty', ['key']],
  ['ClassProperty', ['key']],
  ['ClassAccessorProperty', ['key']],
  ['TSDeclareMethod', ['key']],
]);

/** The keys that hold TypeScript types, which read no value binding. Babel 7 puts a call's type arguments under `typeParameters`, Babel 8 under `typeArguments`. A return type needs no key: Babel wraps it in a `TSTypeAnnotation`, whose `typeAnnotation` is skipped. */
const typeKeys: readonly string[] = [
  'typeAnnotation',
  'typeParameters',
  'typeArguments',
  'superTypeParameters',
  'superTypeArguments',
  'implements',
];

/** TypeScript declarations that bind no value this reader follows. */
const typeDeclarations: readonly unknown[] = [
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
  'TSDeclareFunction',
  'TSEnumDeclaration',
  'TSImportEqualsDeclaration',
  'TSIndexSignature',
];

/** The children of `node` that may read or write a binding: not its types or labels. */
function readChildren(node: unknown): readonly unknown[] {
  const type = field(node, 'type');
  const skipped = [
    typeKeys,
    nameKeys.get(type),
    field(node, 'computed') === true ? undefined : keyNames.get(type),
  ]
    .filter(isStringArray)
    .flat()
    .map((key) => field(node, key))
    .flatMap((value) => (Array.isArray(value) ? list(value) : [value]));

  return childNodes(node).filter((child) => !skipped.includes(child));
}

/** Resolves every name of `program` as Babel's scope does, in one walk: declarations first, then each read or write by its name up the scopes it stands in, so a `var` or function declaration below a read is found. */
export function fileScope(program: unknown): FileScope {
  const resolved = new WeakMap<object, DeclaredBinding>();
  const references: (readonly [object, Scope])[] = [];
  const writes: (readonly [object, unknown])[] = [];
  const writtenMembers: unknown[] = [];
  const written = new Map<DeclaredBinding, unknown[]>();
  const addWrite = (binding: DeclaredBinding, writer: unknown): void => {
    const writers = written.get(binding);

    if (writers === undefined) {
      written.set(binding, [writer]);
    } else {
      writers.push(writer);
    }
  };
  const scopeIn = (parent: Scope | undefined, holdsVar = false): Scope => ({
    parent,
    holdsVar,
    bindings: new Map(),
  });
  const varScope = (scope: Scope): Scope =>
    scope.holdsVar || scope.parent === undefined
      ? scope
      : varScope(scope.parent);
  /** Binds `identifier`, or, when its scope already binds the name, as a second `var` or a `var` over a parameter does, writes the existing binding. */
  const declare = (identifier: unknown, declaration: Declaration): void => {
    const name = field(identifier, 'name');

    if (typeof name !== 'string' || !isRecord(identifier)) {
      return;
    }

    const existing = declaration.scope.bindings.get(name);
    const binding = existing ?? {
      kind: declaration.kind,
      identifier,
      declaration: declaration.node,
    };

    if (existing !== undefined) {
      addWrite(existing, declaration.node);
    }

    declaration.scope.bindings.set(name, binding);
    resolved.set(identifier, binding);
  };
  /** Gives `onName` each identifier that `pattern` declares or writes, type wrappers aside, and reads its defaults, computed keys and member targets in `scope`. */
  const eachName = (
    pattern: unknown,
    scope: Scope,
    onName: (identifier: object) => void,
  ): void => {
    const node = unwrap(pattern);
    const type = field(node, 'type');

    if (type === 'Identifier' && isRecord(node)) {
      onName(node);
    } else if (type === 'ObjectPattern') {
      list(field(node, 'properties')).forEach((property) => {
        if (field(property, 'computed') === true) {
          visit(field(property, 'key'), scope);
        }

        eachName(
          field(
            property,
            field(property, 'type') === 'RestElement' ? 'argument' : 'value',
          ),
          scope,
          onName,
        );
      });
    } else if (type === 'ArrayPattern') {
      list(field(node, 'elements')).forEach((element) =>
        eachName(element, scope, onName),
      );
    } else if (type === 'AssignmentPattern') {
      eachName(field(node, 'left'), scope, onName);
      visit(field(node, 'right'), scope);
    } else if (type === 'RestElement') {
      eachName(field(node, 'argument'), scope, onName);
    } else {
      if (isMember(node)) {
        writtenMembers.push(node);
      }

      visit(node, scope);
    }
  };
  const declarePattern = (pattern: unknown, declaration: Declaration): void =>
    eachName(pattern, declaration.readScope, (identifier) =>
      declare(identifier, declaration),
    );
  /** Reads the names `target` writes by `writer`, such as the left side of an assignment. */
  const write = (target: unknown, writer: unknown, scope: Scope): void =>
    eachName(target, scope, (identifier) => {
      writes.push([identifier, writer]);
      references.push([identifier, scope]);
    });
  const visit = (node: unknown, scope: Scope): void => {
    const type = field(node, 'type');

    if (type === 'Identifier' && isRecord(node)) {
      references.push([node, scope]);

      return;
    }

    if (typeDeclarations.includes(type)) {
      return;
    }

    if (type === 'TSModuleDeclaration') {
      if (field(node, 'declare') !== true) {
        visit(field(node, 'body'), scopeIn(scope, true));
      }

      return;
    }

    if (isFunction(node)) {
      const own = type === 'FunctionDeclaration' ? scope : scopeIn(scope);
      const params = scopeIn(own, true);

      if (field(node, 'computed') === true) {
        visit(field(node, 'key'), scope);
      }

      declare(field(node, 'id'), {
        kind: 'function',
        scope: own,
        readScope: own,
        node,
      });

      list(field(node, 'params')).forEach((param) =>
        declarePattern(
          field(param, 'type') === 'TSParameterProperty'
            ? field(param, 'parameter')
            : param,
          {
            kind: 'param',
            scope: params,
            readScope: params,
            node: param,
          },
        ),
      );

      visit(field(node, 'body'), params);

      return;
    }

    if (type === 'ClassDeclaration') {
      declare(field(node, 'id'), {
        kind: 'class',
        scope,
        readScope: scope,
        node,
      });
    }

    if (type === 'ClassExpression') {
      const inner = scopeIn(scope);

      declare(field(node, 'id'), {
        kind: 'class',
        scope: inner,
        readScope: inner,
        node,
      });
      readChildren(node).forEach((child) => visit(child, inner));

      return;
    }

    if (type === 'ImportDeclaration') {
      list(field(node, 'specifiers')).forEach((specifier) =>
        declare(field(specifier, 'local'), {
          kind: 'import',
          scope,
          readScope: scope,
          node: specifier,
        }),
      );

      return;
    }

    if (blockScopes.includes(type)) {
      const inner = scopeIn(scope, type === 'StaticBlock');

      readChildren(node).forEach((child) => visit(child, inner));

      return;
    }

    if (type === 'CatchClause') {
      const inner = scopeIn(scope);

      declarePattern(field(node, 'param'), {
        kind: 'let',
        scope: inner,
        readScope: inner,
        node,
      });
      list(field(node, 'body', 'body')).forEach((child) => visit(child, inner));

      return;
    }

    if (type === 'SwitchStatement') {
      const cases = scopeIn(scope);

      visit(field(node, 'discriminant'), scope);
      list(field(node, 'cases')).forEach((child) => visit(child, cases));

      return;
    }

    if (type === 'VariableDeclaration') {
      const declared = field(node, 'kind');
      const kind =
        declared === 'var' || declared === 'let' ? declared : 'const';

      list(field(node, 'declarations')).forEach((declarator) => {
        declarePattern(field(declarator, 'id'), {
          kind,
          scope: kind === 'var' ? varScope(scope) : scope,
          readScope: scope,
          node: declarator,
        });
        visit(field(declarator, 'init'), scope);
      });

      return;
    }

    if (type === 'AssignmentExpression') {
      write(field(node, 'left'), node, scope);
      visit(field(node, 'right'), scope);

      return;
    }

    if (type === 'ForOfStatement' || type === 'ForInStatement') {
      const head = scopeIn(scope);

      // A declaring head is no pattern, so eachName visits it as a declaration rather than writing it.
      write(field(node, 'left'), node, head);
      visit(field(node, 'right'), head);
      visit(field(node, 'body'), head);

      return;
    }

    if (type === 'UpdateExpression') {
      write(field(node, 'argument'), node, scope);

      return;
    }

    readChildren(node).forEach((child) => visit(child, scope));
  };

  visit(program, scopeIn(undefined));
  references.forEach(([identifier, scope]) => {
    const binding = lookUp(scope, field(identifier, 'name'));

    if (binding !== undefined) {
      resolved.set(identifier, binding);
    }
  });
  writes.forEach(([identifier, writer]) => {
    const binding = resolved.get(identifier);

    if (binding !== undefined) {
      addWrite(binding, writer);
    }
  });

  const bindings = new Map<DeclaredBinding, Binding>();
  const bindingOf = (identifier: unknown): Binding | undefined => {
    const declared = isRecord(identifier)
      ? resolved.get(identifier)
      : undefined;

    if (declared === undefined) {
      return undefined;
    }

    const binding = bindings.get(declared) ?? {
      ...declared,
      writes: written.get(declared) ?? [],
    };

    bindings.set(declared, binding);

    return binding;
  };
  const read = new Set(references.map(([identifier]) => identifier));
  const referencesIn = (node: unknown): readonly unknown[] =>
    isRecord(node) && read.has(node)
      ? [node]
      : childNodes(node).flatMap(referencesIn);

  return { bindingOf, referencesIn, writtenMembers };
}

function lookUp(
  scope: Scope | undefined,
  name: unknown,
): DeclaredBinding | undefined {
  if (scope === undefined || typeof name !== 'string') {
    return undefined;
  }

  return scope.bindings.get(name) ?? lookUp(scope.parent, name);
}
