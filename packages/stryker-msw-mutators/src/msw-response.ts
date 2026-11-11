import type { NodePath, types } from '@babel/core';

import type { BabelTypes, LzMswMutator } from './mutator.ts';

/** The static methods of msw's `HttpResponse` that build a response with a body. */
const factories: readonly string[] = [
  'json',
  'text',
  'xml',
  'html',
  'arrayBuffer',
  'formData',
];

/** msw's namespaces of request handlers, each with the methods that take a handler callback. */
const handlerMethods: readonly (readonly [string, readonly string[]])[] = [
  ['http', ['all', 'get', 'post', 'put', 'patch', 'delete', 'head', 'options']],
  ['graphql', ['query', 'mutation', 'operation']],
];

export function mswResponseMutator(): LzMswMutator & {
  readonly name: 'LzMswResponse';
} {
  return {
    name: 'LzMswResponse',
    sample:
      "import { http, HttpResponse } from 'msw';\n" +
      "export const handlers = [http.get('/a', () => HttpResponse.json({ a: 1 }))];\n",
    *mutate(path, t) {
      if (!path.isCallExpression() && !path.isNewExpression()) {
        return;
      }

      const owner = errorOwnerOf(path);

      if (owner === undefined || !isInHandler(path)) {
        return;
      }

      const [body] = path.node.arguments;
      const empty = body === undefined ? undefined : emptyOf(body, t);

      if (empty !== undefined) {
        const emptied = t.cloneNode(path.node, true);

        emptied.arguments = [empty, ...emptied.arguments.slice(1)];

        yield emptied;
      }

      yield t.callExpression(
        t.memberExpression(t.identifier(owner), t.identifier('error')),
        [],
      );
    },
  };
}

/** The local name of the class whose `error()` replaces the response `call` builds, when it builds one. */
function errorOwnerOf(
  call: NodePath<types.CallExpression | types.NewExpression>,
): string | undefined {
  const callee = call.get('callee');

  if (call.isNewExpression()) {
    return callee.isIdentifier() &&
      (isMswImport(callee, 'HttpResponse') || isGlobalResponse(callee))
      ? callee.node.name
      : undefined;
  }

  if (callee.isIdentifier()) {
    return destructuredOwnerOf(callee);
  }

  if (!callee.isMemberExpression({ computed: false })) {
    return undefined;
  }

  const object = callee.get('object');

  return object.isIdentifier() &&
    isMswImport(object, 'HttpResponse') &&
    factories.some((name) => callee.get('property').isIdentifier({ name }))
    ? object.node.name
    : undefined;
}

/** `Response` with no binding in the file, so the Fetch API's. */
function isGlobalResponse(name: NodePath<types.Identifier>): boolean {
  return (
    name.node.name === 'Response' &&
    name.scope.getBinding('Response') === undefined
  );
}

/** The local name of msw's `HttpResponse` when `factory` is bound by `const { <factory> } = HttpResponse`. */
function destructuredOwnerOf(
  factory: NodePath<types.Identifier>,
): string | undefined {
  const declarator = factory.scope.getBinding(factory.node.name)?.path;

  if (declarator?.isVariableDeclarator() !== true) {
    return undefined;
  }

  const pattern = declarator.get('id');
  const init = declarator.get('init');

  return pattern.isObjectPattern() &&
    init.isIdentifier() &&
    isMswImport(init, 'HttpResponse') &&
    pattern.node.properties.some(
      (property) =>
        property.type === 'ObjectProperty' &&
        !property.computed &&
        property.key.type === 'Identifier' &&
        factories.includes(property.key.name) &&
        property.value.type === 'Identifier' &&
        property.value.name === factory.node.name,
    )
    ? init.node.name
    : undefined;
}

/** `path` sits in a function, at any depth, that is an argument of `http.<method>(...)` or `graphql.<operation>(...)`. */
function isInHandler(path: NodePath): boolean {
  return (
    path.findParent(
      (parent) => parent.isFunction() && isHandlerCallback(parent),
    ) !== null
  );
}

function isHandlerCallback(fn: NodePath): boolean {
  const call = fn.parentPath;

  if (fn.listKey !== 'arguments' || call?.isCallExpression() !== true) {
    return false;
  }

  const callee = call.get('callee');

  return (
    callee.isMemberExpression({ computed: false }) &&
    handlerMethods.some(
      ([namespace, methods]) =>
        isMswImport(callee.get('object'), namespace) &&
        methods.some((name) => callee.get('property').isIdentifier({ name })),
    )
  );
}

/** `path` is an identifier bound by `import { <exported> } from 'msw'`, under any local name. */
function isMswImport(path: NodePath, exported: string): boolean {
  const binding = path.isIdentifier()
    ? path.scope.getBinding(path.node.name)
    : undefined;
  const specifier = binding?.path;
  const declaration = specifier?.parentPath;

  return (
    specifier?.isImportSpecifier() === true &&
    importedName(specifier.node.imported) === exported &&
    declaration?.isImportDeclaration() === true &&
    declaration.node.source.value === 'msw'
  );
}

function importedName(
  imported: types.Identifier | types.StringLiteral,
): string {
  return imported.type === 'Identifier' ? imported.name : imported.value;
}

/** The empty body of the same kind as `body`: `{}`, `[]` or `''`, else `null`; undefined when `body` is empty already. */
function emptyOf(
  body: types.Node,
  t: BabelTypes,
): types.Expression | undefined {
  if (body.type === 'ObjectExpression') {
    return body.properties.length === 0 ? undefined : t.objectExpression([]);
  }

  if (body.type === 'ArrayExpression') {
    return body.elements.length === 0 ? undefined : t.arrayExpression([]);
  }

  if (body.type === 'StringLiteral') {
    return body.value === '' ? undefined : t.stringLiteral('');
  }

  if (body.type === 'TemplateLiteral') {
    return t.stringLiteral('');
  }

  return body.type === 'NullLiteral' ? undefined : t.nullLiteral();
}
