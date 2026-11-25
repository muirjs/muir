import {
  muirMoiraMutatorsArgumentOf,
  muirMoiraMutatorsBindingOf,
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsMemberNameOf,
} from '@muirjs/moira-mutators';

import {
  muirProteusPlaywrightAncestors,
  muirProteusPlaywrightHasProperty,
  muirProteusPlaywrightIsCall,
  muirProteusPlaywrightIsRequestContext,
  muirProteusPlaywrightIsRequestFactory,
} from './ast.ts';
import type { MuirProteusPlaywrightMutator } from './mutators.ts';

/** The methods that send a GET or HEAD request; `fetch` sends a GET unless it has a method option. */
const getMethods: readonly unknown[] = ['get', 'head', 'fetch'];
/** The URL parser reads any two of `/` and `\` at the start of a URL as the start of a host. */
const absolute = /^([a-z][a-z0-9+.-]*:|[\\/]{2})/i;
const localHost =
  /^(https?:)?[\\/]{2}(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])([:/?#]|$)/i;

/** An absolute URL to a host other than this machine: emptying it would leave the service under test. */
function isThirdParty(url: string): boolean {
  return absolute.test(url) && !localHost.test(url);
}

export function muirProteusPlaywrightRequestUrlMutator<
  const TName extends string,
>(
  name: TName,
  sample: string,
): MuirProteusPlaywrightMutator & { readonly name: TName } {
  return {
    name,
    sample,
    *mutate(path, t) {
      if (
        isCandidate(muirMoiraMutatorsFieldOf(path, 'node')) &&
        (isReadUrlArgument(path) || isLoopUrl(path))
      ) {
        yield t.stringLiteral('');
      }
    },
  };
}

/** A string or template literal that is not empty and does not name a third-party host. */
function isCandidate(node: unknown): boolean {
  const text = urlText(node);

  return (
    text !== undefined &&
    (text !== '' || hasExpressions(node)) &&
    !isThirdParty(text)
  );
}

/** The URL argument of a GET or HEAD request call whose result is read. */
function isReadUrlArgument(path: unknown): boolean {
  const call = muirMoiraMutatorsFieldOf(path, 'parent');
  const callee = muirMoiraMutatorsFieldOf(call, 'callee');
  const method = muirMoiraMutatorsMemberNameOf(callee);

  return (
    muirMoiraMutatorsArgumentOf(call, 0) ===
      muirMoiraMutatorsFieldOf(path, 'node') &&
    isRequestReceiver(path, muirMoiraMutatorsFieldOf(callee, 'object')) &&
    getMethods.includes(method) &&
    !(method === 'fetch' && hasMethodOption(call)) &&
    resultIsRead(muirMoiraMutatorsFieldOf(path, 'parentPath'))
  );
}

/** An element of the array of `for (const <x> of [...])` where `<x>` is a read URL argument in the loop. */
function isLoopUrl(path: unknown): boolean {
  const loop = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsFieldOf(path, 'parentPath'),
    'parentPath',
  );
  const loopNode = muirMoiraMutatorsFieldOf(loop, 'node');
  const declarations = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsFieldOf(loopNode, 'left'),
    'declarations',
  );

  if (
    muirMoiraMutatorsFieldOf(path, 'listKey') !== 'elements' ||
    muirMoiraMutatorsFieldOf(loopNode, 'type') !== 'ForOfStatement' ||
    !Array.isArray(declarations)
  ) {
    return false;
  }

  const variable = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsFieldOf(declarations[0], 'id'),
    'name',
  );
  const references = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsBindingOf(loop, variable),
    'referencePaths',
  );

  return Array.isArray(references) && references.some(isReadUrlArgument);
}

/** The text of a string literal, or of a template literal up to its first expression. */
function urlText(node: unknown): string | undefined {
  const type = muirMoiraMutatorsFieldOf(node, 'type');

  if (type === 'StringLiteral') {
    return String(muirMoiraMutatorsFieldOf(node, 'value'));
  }

  const quasis = muirMoiraMutatorsFieldOf(node, 'quasis');

  return Array.isArray(quasis)
    ? String(
        muirMoiraMutatorsFieldOf(
          muirMoiraMutatorsFieldOf(quasis[0], 'value'),
          'cooked',
        ),
      )
    : undefined;
}

function hasExpressions(template: unknown): boolean {
  const expressions = muirMoiraMutatorsFieldOf(template, 'expressions');

  return Array.isArray(expressions) && expressions.length > 0;
}

/** A request context: one by `isRequestContext`, or a name bound to `await <request factory>.newContext(...)`. */
function isRequestReceiver(path: unknown, node: unknown): boolean {
  if (muirProteusPlaywrightIsRequestContext(path, node)) {
    return true;
  }

  const binding = muirMoiraMutatorsBindingOf(
    path,
    muirMoiraMutatorsFieldOf(node, 'name'),
  );
  const assignments = muirMoiraMutatorsFieldOf(binding, 'constantViolations');

  return (
    isNewContextCall(
      muirMoiraMutatorsFieldOf(
        muirMoiraMutatorsFieldOf(
          muirMoiraMutatorsFieldOf(binding, 'path'),
          'node',
        ),
        'init',
      ),
    ) ||
    (Array.isArray(assignments) &&
      assignments.some((assignment) =>
        isNewContextCall(
          muirMoiraMutatorsFieldOf(
            muirMoiraMutatorsFieldOf(assignment, 'node'),
            'right',
          ),
        ),
      ))
  );
}

function isNewContextCall(node: unknown): boolean {
  const call =
    muirMoiraMutatorsFieldOf(node, 'type') === 'AwaitExpression'
      ? muirMoiraMutatorsFieldOf(node, 'argument')
      : node;
  const callee = muirMoiraMutatorsFieldOf(call, 'callee');

  return (
    muirProteusPlaywrightIsCall(call) &&
    muirMoiraMutatorsMemberNameOf(callee) === 'newContext' &&
    muirProteusPlaywrightIsRequestFactory(
      muirMoiraMutatorsFieldOf(callee, 'object'),
    )
  );
}

function resultIsRead(callPath: unknown): boolean {
  const parentPath = muirMoiraMutatorsFieldOf(callPath, 'parentPath');
  const userPath =
    muirMoiraMutatorsFieldOf(
      muirMoiraMutatorsFieldOf(parentPath, 'node'),
      'type',
    ) === 'AwaitExpression'
      ? muirMoiraMutatorsFieldOf(parentPath, 'parentPath')
      : parentPath;
  const user = muirMoiraMutatorsFieldOf(userPath, 'node');

  switch (muirMoiraMutatorsFieldOf(user, 'type')) {
    case 'ExpressionStatement':
      return false;
    case 'UnaryExpression':
      return muirMoiraMutatorsFieldOf(user, 'operator') !== 'void';
    case 'AssignmentExpression': {
      const left = muirMoiraMutatorsFieldOf(user, 'left');

      return (
        muirMoiraMutatorsFieldOf(
          muirMoiraMutatorsFieldOf(userPath, 'parent'),
          'type',
        ) !== 'ExpressionStatement' ||
        muirMoiraMutatorsFieldOf(left, 'type') !== 'Identifier' ||
        isReadVariable(userPath, left)
      );
    }
    default: {
      const id = muirMoiraMutatorsFieldOf(user, 'id');

      return (
        muirMoiraMutatorsFieldOf(id, 'type') !== 'Identifier' ||
        isReadVariable(userPath, id)
      );
    }
  }
}

/** The variable that `identifier` names has a reference outside a console call. */
function isReadVariable(path: unknown, identifier: unknown): boolean {
  const references = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsBindingOf(
      path,
      muirMoiraMutatorsFieldOf(identifier, 'name'),
    ),
    'referencePaths',
  );

  return (
    Array.isArray(references) &&
    references.some((reference) => !isInConsoleCall(reference))
  );
}

/** Some call around `path` is `console.<x>(...)`. */
function isInConsoleCall(path: unknown): boolean {
  return [...muirProteusPlaywrightAncestors(path)].some(
    (ancestor) =>
      muirMoiraMutatorsFieldOf(
        muirMoiraMutatorsFieldOf(
          muirMoiraMutatorsFieldOf(
            muirMoiraMutatorsFieldOf(ancestor, 'node'),
            'callee',
          ),
          'object',
        ),
        'name',
      ) === 'console',
  );
}

/** The options argument names a method, or may: it is no object literal, or it holds a spread. `get` and `head` set
 * their own method over any option, so only `fetch` asks. */
function hasMethodOption(call: unknown): boolean {
  const options = muirMoiraMutatorsArgumentOf(call, 1);

  if (options === undefined) {
    return false;
  }

  const properties = muirMoiraMutatorsFieldOf(options, 'properties');

  return (
    !Array.isArray(properties) ||
    properties.some(
      (property) =>
        muirMoiraMutatorsFieldOf(property, 'type') === 'SpreadElement',
    ) ||
    muirProteusPlaywrightHasProperty(options, 'method')
  );
}
