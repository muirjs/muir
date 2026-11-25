import {
  muirMoiraStorybookIsMember,
  muirMoiraStorybookUnwrap,
} from './csf-nodes.ts';
import {
  muirMoiraStorybookIsRecord,
  muirMoiraStorybookIsStringArray,
} from './is-record.ts';
import {
  muirMoiraStorybookField,
  muirMoiraStorybookList,
} from './node-field.ts';
import {
  muirMoiraStorybookChildNodes,
  muirMoiraStorybookIsFunction,
} from './node-tree.ts';

type BindingKind =
  | 'var'
  | 'let'
  | 'const'
  | 'param'
  | 'function'
  | 'class'
  | 'import';

export interface MuirMoiraStorybookBinding {
  readonly kind: BindingKind;
  readonly identifier: unknown;
  /** The node that declares it: a variable declarator, an import specifier, a function, a class, a catch clause, or a parameter as the function lists it. */
  readonly declaration: unknown;
  /**
   * The nodes that give the binding another value after its declaration: each assignment, update or loop head that
   * writes the name, and each second declaration of the name in its scope, such as a later `var` declarator.
   */
  readonly writes: readonly unknown[];
}

export interface MuirMoiraStorybookFileScope {
  /** The binding an identifier declares, reads or writes; `undefined` when the file binds no such name in reach. */
  readonly bindingOf: (
    identifier: unknown,
  ) => MuirMoiraStorybookBinding | undefined;
  /** The identifiers in `node` that read or write a binding, in source order. */
  readonly referencesIn: (node: unknown) => readonly unknown[];
  /** The members a write targets, such as `a.b` in `a.b = c`, `[a.b] = c` or `for (a.b of c)`. */
  readonly writtenMembers: readonly unknown[];
}

type DeclaredBinding = Omit<MuirMoiraStorybookBinding, 'writes'>;

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
  const type = muirMoiraStorybookField(node, 'type');
  const skipped = [
    typeKeys,
    nameKeys.get(type),
    muirMoiraStorybookField(node, 'computed') === true
      ? undefined
      : keyNames.get(type),
  ]
    .filter(muirMoiraStorybookIsStringArray)
    .flat()
    .map((key) => muirMoiraStorybookField(node, key))
    .flatMap((value) =>
      Array.isArray(value) ? muirMoiraStorybookList(value) : [value],
    );

  return muirMoiraStorybookChildNodes(node).filter(
    (child) => !skipped.includes(child),
  );
}

/** The function a binding names: `function <name>() {}`, or `<let | const | var> <name> = <function>`, through any parentheses, cast or non-null assertion around the function. */
function declaredFunction(
  binding: MuirMoiraStorybookBinding | undefined,
): unknown {
  if (binding?.kind === 'function') {
    return binding.declaration;
  }

  const declaration = binding?.declaration;
  const init = muirMoiraStorybookUnwrap(
    muirMoiraStorybookField(declaration, 'init'),
  );

  return muirMoiraStorybookField(declaration, 'id') === binding?.identifier &&
    muirMoiraStorybookIsFunction(init)
    ? init
    : undefined;
}

/** The functions a binding may name: the one it is declared with, and each one a write of any assignment operator or a later `var` declaration of the same name gives it, through any parentheses, cast or non-null assertion; none for `undefined`. */
export function muirMoiraStorybookFunctionsOf(
  binding: MuirMoiraStorybookBinding | undefined,
): readonly unknown[] {
  return [
    declaredFunction(binding),
    // Stryker disable next-line ArrayDeclaration: the isFunction filter below drops anything the fallback holds
    ...(binding?.writes ?? []).map((write) =>
      muirMoiraStorybookUnwrap(
        muirMoiraStorybookField(write, 'right') ??
          muirMoiraStorybookField(write, 'init'),
      ),
    ),
  ].filter(muirMoiraStorybookIsFunction);
}

/** Resolves every name of `program` as Babel's scope does, in one walk: declarations first, then each read or write by its name up the scopes it stands in, so a `var` or function declaration below a read is found. */
export function muirMoiraStorybookFileScope(
  program: unknown,
): MuirMoiraStorybookFileScope {
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
    const name = muirMoiraStorybookField(identifier, 'name');

    if (typeof name !== 'string' || !muirMoiraStorybookIsRecord(identifier)) {
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
    const node = muirMoiraStorybookUnwrap(pattern);
    const type = muirMoiraStorybookField(node, 'type');

    if (type === 'Identifier' && muirMoiraStorybookIsRecord(node)) {
      onName(node);
    } else if (type === 'ObjectPattern') {
      muirMoiraStorybookList(
        muirMoiraStorybookField(node, 'properties'),
      ).forEach((property) => {
        if (muirMoiraStorybookField(property, 'computed') === true) {
          visit(muirMoiraStorybookField(property, 'key'), scope);
        }

        eachName(
          muirMoiraStorybookField(
            property,
            muirMoiraStorybookField(property, 'type') === 'RestElement'
              ? 'argument'
              : 'value',
          ),
          scope,
          onName,
        );
      });
    } else if (type === 'ArrayPattern') {
      muirMoiraStorybookList(muirMoiraStorybookField(node, 'elements')).forEach(
        (element) => eachName(element, scope, onName),
      );
    } else if (type === 'AssignmentPattern') {
      eachName(muirMoiraStorybookField(node, 'left'), scope, onName);
      visit(muirMoiraStorybookField(node, 'right'), scope);
    } else if (type === 'RestElement') {
      eachName(muirMoiraStorybookField(node, 'argument'), scope, onName);
    } else {
      if (muirMoiraStorybookIsMember(node)) {
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
    const type = muirMoiraStorybookField(node, 'type');

    if (type === 'Identifier' && muirMoiraStorybookIsRecord(node)) {
      references.push([node, scope]);

      return;
    }

    if (typeDeclarations.includes(type)) {
      return;
    }

    if (type === 'TSModuleDeclaration') {
      if (muirMoiraStorybookField(node, 'declare') !== true) {
        visit(muirMoiraStorybookField(node, 'body'), scopeIn(scope, true));
      }

      return;
    }

    if (muirMoiraStorybookIsFunction(node)) {
      const own = type === 'FunctionDeclaration' ? scope : scopeIn(scope);
      const params = scopeIn(own, true);

      if (muirMoiraStorybookField(node, 'computed') === true) {
        visit(muirMoiraStorybookField(node, 'key'), scope);
      }

      declare(muirMoiraStorybookField(node, 'id'), {
        kind: 'function',
        scope: own,
        readScope: own,
        node,
      });

      muirMoiraStorybookList(muirMoiraStorybookField(node, 'params')).forEach(
        (param) =>
          declarePattern(
            muirMoiraStorybookField(param, 'type') === 'TSParameterProperty'
              ? muirMoiraStorybookField(param, 'parameter')
              : param,
            {
              kind: 'param',
              scope: params,
              readScope: params,
              node: param,
            },
          ),
      );

      visit(muirMoiraStorybookField(node, 'body'), params);

      return;
    }

    if (type === 'ClassDeclaration') {
      declare(muirMoiraStorybookField(node, 'id'), {
        kind: 'class',
        scope,
        readScope: scope,
        node,
      });
    }

    if (type === 'ClassExpression') {
      const inner = scopeIn(scope);

      declare(muirMoiraStorybookField(node, 'id'), {
        kind: 'class',
        scope: inner,
        readScope: inner,
        node,
      });
      readChildren(node).forEach((child) => visit(child, inner));

      return;
    }

    if (type === 'ImportDeclaration') {
      muirMoiraStorybookList(
        muirMoiraStorybookField(node, 'specifiers'),
      ).forEach((specifier) =>
        declare(muirMoiraStorybookField(specifier, 'local'), {
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

      declarePattern(muirMoiraStorybookField(node, 'param'), {
        kind: 'let',
        scope: inner,
        readScope: inner,
        node,
      });
      muirMoiraStorybookList(
        muirMoiraStorybookField(node, 'body', 'body'),
      ).forEach((child) => visit(child, inner));

      return;
    }

    if (type === 'SwitchStatement') {
      const cases = scopeIn(scope);

      visit(muirMoiraStorybookField(node, 'discriminant'), scope);
      muirMoiraStorybookList(muirMoiraStorybookField(node, 'cases')).forEach(
        (child) => visit(child, cases),
      );

      return;
    }

    if (type === 'VariableDeclaration') {
      const declared = muirMoiraStorybookField(node, 'kind');
      const kind =
        declared === 'var' || declared === 'let' ? declared : 'const';

      muirMoiraStorybookList(
        muirMoiraStorybookField(node, 'declarations'),
      ).forEach((declarator) => {
        declarePattern(muirMoiraStorybookField(declarator, 'id'), {
          kind,
          scope: kind === 'var' ? varScope(scope) : scope,
          readScope: scope,
          node: declarator,
        });
        visit(muirMoiraStorybookField(declarator, 'init'), scope);
      });

      return;
    }

    if (type === 'AssignmentExpression') {
      write(muirMoiraStorybookField(node, 'left'), node, scope);
      visit(muirMoiraStorybookField(node, 'right'), scope);

      return;
    }

    if (type === 'ForOfStatement' || type === 'ForInStatement') {
      const head = scopeIn(scope);

      // A declaring head is no pattern, so eachName visits it as a declaration rather than writing it.
      write(muirMoiraStorybookField(node, 'left'), node, head);
      visit(muirMoiraStorybookField(node, 'right'), head);
      visit(muirMoiraStorybookField(node, 'body'), head);

      return;
    }

    if (type === 'UpdateExpression') {
      write(muirMoiraStorybookField(node, 'argument'), node, scope);

      return;
    }

    readChildren(node).forEach((child) => visit(child, scope));
  };

  visit(program, scopeIn(undefined));
  references.forEach(([identifier, scope]) => {
    const binding = lookUp(scope, muirMoiraStorybookField(identifier, 'name'));

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

  const bindings = new Map<DeclaredBinding, MuirMoiraStorybookBinding>();
  const bindingOf = (
    identifier: unknown,
  ): MuirMoiraStorybookBinding | undefined => {
    const declared = muirMoiraStorybookIsRecord(identifier)
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
    muirMoiraStorybookIsRecord(node) && read.has(node)
      ? [node]
      : muirMoiraStorybookChildNodes(node).flatMap(referencesIn);

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
