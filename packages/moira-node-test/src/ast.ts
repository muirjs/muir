import type { NodePath, types } from '@babel/core';

export interface MuirMoiraNodeTestImportOf {
  readonly source: string;
  readonly imported: string | undefined;
}

/** Only ES module `import` declarations count: the mutators do not read CommonJS `require`. */
export function muirMoiraNodeTestImportOf(
  path: NodePath,
  name: string,
): MuirMoiraNodeTestImportOf | undefined {
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

export function muirMoiraNodeTestPropertyName(
  member: types.Node,
): string | undefined {
  return member.type === 'MemberExpression' &&
    !member.computed &&
    member.property.type === 'Identifier'
    ? member.property.name
    : undefined;
}

export function muirMoiraNodeTestAwaited(
  expression: types.Expression,
): types.Expression {
  return expression.type === 'AwaitExpression'
    ? expression.argument
    : expression;
}

export function muirMoiraNodeTestCalleeRoot(
  callee: types.Node,
): types.Identifier | undefined {
  if (callee.type === 'MemberExpression') {
    return muirMoiraNodeTestCalleeRoot(callee.object);
  }

  return callee.type === 'Identifier' ? callee : undefined;
}
