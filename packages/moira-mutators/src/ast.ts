import type { NodePath, types } from '@babel/core';

import { muirMoiraMutatorsFieldOf } from './is-record.ts';

export interface MuirMoiraMutatorsImportOf {
  readonly source: string;
  readonly imported: string | undefined;
}

/** Only ES module `import` declarations count: the mutators do not read CommonJS `require`. */
export function muirMoiraMutatorsImportOf(
  path: NodePath,
  name: string,
): MuirMoiraMutatorsImportOf | undefined {
  const bound = path.scope.getBinding(name)?.path;

  if (bound?.parent.type !== 'ImportDeclaration') {
    return undefined;
  }

  const { parent: declaration, node: specifier } = bound;

  return {
    source: declaration.source.value,
    imported:
      specifier.type === 'ImportSpecifier'
        ? exportedName(specifier.imported)
        : undefined,
  };
}

function exportedName(
  imported: types.Identifier | types.StringLiteral,
): string {
  return imported.type === 'Identifier' ? imported.name : imported.value;
}

export function muirMoiraMutatorsPropertyName(
  member: types.Node,
): string | undefined {
  return member.type === 'MemberExpression' &&
    !member.computed &&
    member.property.type === 'Identifier'
    ? member.property.name
    : undefined;
}

export function muirMoiraMutatorsAwaited(
  expression: types.Expression,
): types.Expression {
  return expression.type === 'AwaitExpression'
    ? expression.argument
    : expression;
}

export function muirMoiraMutatorsCalleeRoot(
  callee: types.Node,
): types.Identifier | undefined {
  if (callee.type === 'MemberExpression') {
    return muirMoiraMutatorsCalleeRoot(callee.object);
  }

  return callee.type === 'Identifier' ? callee : undefined;
}

export const muirMoiraMutatorsCallTypes: readonly unknown[] = [
  'CallExpression',
  'OptionalCallExpression',
];
export const muirMoiraMutatorsMemberTypes: readonly unknown[] = [
  'MemberExpression',
  'OptionalMemberExpression',
];

/** The Babel binding that `name` refers to in the scope of `path`. */
export function muirMoiraMutatorsBindingOf(
  path: unknown,
  name: unknown,
): unknown {
  const scope = muirMoiraMutatorsFieldOf(path, 'scope');
  const getBinding = muirMoiraMutatorsFieldOf(scope, 'getBinding');

  return typeof getBinding === 'function'
    ? Reflect.apply(getBinding, scope, [name])
    : undefined;
}

/** `<x>.<y>`, `<x>[<y>]`, or either through `?.`. */
export function muirMoiraMutatorsIsMember(node: unknown): boolean {
  return muirMoiraMutatorsMemberTypes.includes(
    muirMoiraMutatorsFieldOf(node, 'type'),
  );
}

/** The property name of `<x>.<name>` or `<x>?.<name>`. */
export function muirMoiraMutatorsMemberNameOf(member: unknown): unknown {
  return muirMoiraMutatorsIsMember(member) &&
    muirMoiraMutatorsFieldOf(member, 'computed') === false
    ? muirMoiraMutatorsFieldOf(
        muirMoiraMutatorsFieldOf(member, 'property'),
        'name',
      )
    : undefined;
}

export function muirMoiraMutatorsArgumentOf(
  call: unknown,
  index: number,
): unknown {
  const args = muirMoiraMutatorsFieldOf(call, 'arguments');

  return Array.isArray(args) ? args[index] : undefined;
}

/** The key of a non-computed property: the name of an identifier key, or the value of a literal key. */
export function muirMoiraMutatorsPropertyKey(property: unknown): unknown {
  const key = muirMoiraMutatorsFieldOf(property, 'key');

  return muirMoiraMutatorsFieldOf(property, 'computed') === false
    ? (muirMoiraMutatorsFieldOf(key, 'name') ??
        muirMoiraMutatorsFieldOf(key, 'value'))
    : undefined;
}

/** The property of the object literal whose key, by `propertyKey`, is `key`. */
export function muirMoiraMutatorsFindProperty(
  object: unknown,
  key: string,
): unknown {
  const properties = muirMoiraMutatorsFieldOf(object, 'properties');

  return Array.isArray(properties)
    ? properties.find(
        (property) => muirMoiraMutatorsPropertyKey(property) === key,
      )
    : undefined;
}
