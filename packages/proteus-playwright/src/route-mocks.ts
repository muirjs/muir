import {
  muirMoiraMutatorsArgumentOf,
  muirMoiraMutatorsBindingOf,
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsMemberNameOf,
  muirMoiraMutatorsPropertyKey,
} from '@muirjs/moira-mutators';

import {
  muirProteusPlaywrightHasProperty,
  muirProteusPlaywrightIsCall,
  muirProteusPlaywrightOutermost,
  muirProteusPlaywrightRowOf,
} from './ast.ts';
import type { MuirProteusPlaywrightMutator } from './mutators.ts';

export function muirProteusPlaywrightFulfillMutator<const TName extends string>(
  name: TName,
  sample: string,
): MuirProteusPlaywrightMutator & { readonly name: TName } {
  return {
    name,
    sample,
    *mutate(path, t) {
      const node = muirMoiraMutatorsFieldOf(path, 'node');

      if (isEmptyValue(node)) {
        return;
      }

      if (isFulfillOption(path, 'json')) {
        yield muirMoiraMutatorsFieldOf(node, 'type') === 'ArrayExpression'
          ? t.arrayExpression([])
          : t.objectExpression([]);
      }

      if (isFulfillOption(path, 'body')) {
        yield t.stringLiteral('');
      }

      if (isFulfillOption(path, 'status')) {
        if (isNumberBetween(node, 200, 399)) {
          yield t.numericLiteral(500);
        }

        if (isNumberBetween(node, 400, 599)) {
          yield t.numericLiteral(200);
        }
      }
    },
  };
}

/** A Route method that settles a request, mapped to the one with the opposite outcome. */
const outcomeFlips: Readonly<Record<string, string>> = {
  abort: 'continue',
  continue: 'abort',
  fallback: 'abort',
};

export function muirProteusPlaywrightOutcomeMutator<const TName extends string>(
  name: TName,
  sample: string,
): MuirProteusPlaywrightMutator & { readonly name: TName } {
  return {
    name,
    sample,
    *mutate(path, t) {
      const node = muirMoiraMutatorsFieldOf(path, 'node');
      const flipped = muirProteusPlaywrightRowOf(
        outcomeFlips,
        muirMoiraMutatorsMemberNameOf(muirMoiraMutatorsFieldOf(node, 'callee')),
      );

      if (!muirProteusPlaywrightIsCall(node) || flipped === undefined) {
        return;
      }

      const route = handlerRouteOf(path, node);

      if (route !== undefined) {
        yield t.callExpression(
          t.memberExpression(t.identifier(route), t.identifier(flipped)),
          [],
        );
      }
    },
  };
}

/** The name of the receiver of `call`, when it is the route parameter of a handler around `path`. */
function handlerRouteOf(path: unknown, call: unknown): string | undefined {
  const route = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsFieldOf(
      muirMoiraMutatorsFieldOf(call, 'callee'),
      'object',
    ),
    'name',
  );

  return typeof route === 'string' && isInHandlerOf(path, route)
    ? route
    : undefined;
}

/** `route`, in the scope of `path`, is the first parameter of a route handler, named on its own or with a default. */
function isInHandlerOf(path: unknown, route: string): boolean {
  const paramPath = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsBindingOf(path, route),
    'path',
  );
  const handlerPath = muirMoiraMutatorsFieldOf(paramPath, 'parentPath');
  const param = withoutDefault(muirMoiraMutatorsFieldOf(paramPath, 'node'));

  return (
    muirMoiraMutatorsFieldOf(param, 'type') === 'Identifier' &&
    muirMoiraMutatorsFieldOf(paramPath, 'key') === 0 &&
    (isRouteAnnotated(param) ||
      isRouteCallback(
        muirMoiraMutatorsFieldOf(handlerPath, 'parent'),
        muirMoiraMutatorsFieldOf(handlerPath, 'node'),
      ))
  );
}

/** The parameter `node` names: the left side of `<name> = <default>`, else `node` itself. */
function withoutDefault(node: unknown): unknown {
  return muirMoiraMutatorsFieldOf(node, 'type') === 'AssignmentPattern'
    ? muirMoiraMutatorsFieldOf(node, 'left')
    : node;
}

/** `handler` is the second argument of `<x>.route(...)`. */
function isRouteCallback(call: unknown, handler: unknown): boolean {
  return (
    muirProteusPlaywrightIsCall(call) &&
    muirMoiraMutatorsArgumentOf(call, 1) === handler &&
    muirMoiraMutatorsMemberNameOf(muirMoiraMutatorsFieldOf(call, 'callee')) ===
      'route'
  );
}

/** The parameter is written `<name>: Route`. */
function isRouteAnnotated(parameter: unknown): boolean {
  const annotation = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsFieldOf(parameter, 'typeAnnotation'),
    'typeAnnotation',
  );

  return (
    muirMoiraMutatorsFieldOf(
      muirMoiraMutatorsFieldOf(annotation, 'typeName'),
      'name',
    ) === 'Route'
  );
}

/** A numeric literal from `min` to `max`. */
function isNumberBetween(node: unknown, min: number, max: number): boolean {
  const value = muirMoiraMutatorsFieldOf(node, 'value');

  return typeof value === 'number' && value >= min && value <= max;
}

/** A fulfill option value that is already empty: `{}`, `[]` or `''`. */
function isEmptyValue(node: unknown): boolean {
  return (
    lengthOf(muirMoiraMutatorsFieldOf(node, 'properties')) === 0 ||
    lengthOf(muirMoiraMutatorsFieldOf(node, 'elements')) === 0 ||
    muirMoiraMutatorsFieldOf(node, 'value') === ''
  );
}

function lengthOf(list: unknown): number | undefined {
  return Array.isArray(list) ? list.length : undefined;
}

/** The value of the property `key` in the object literal that is the first argument of `<route>.fulfill(...)`, under
 * any type wrapper, in a handler of `<route>`. */
function isFulfillOption(path: unknown, key: string): boolean {
  const property = muirMoiraMutatorsFieldOf(path, 'parent');
  const object = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsFieldOf(path, 'parentPath'),
    'parent',
  );
  const optionsPath = muirProteusPlaywrightOutermost(
    muirMoiraMutatorsFieldOf(
      muirMoiraMutatorsFieldOf(path, 'parentPath'),
      'parentPath',
    ),
  );
  const call = muirMoiraMutatorsFieldOf(optionsPath, 'parent');

  return (
    muirMoiraMutatorsPropertyKey(property) === key &&
    muirMoiraMutatorsFieldOf(property, 'value') ===
      muirMoiraMutatorsFieldOf(path, 'node') &&
    muirMoiraMutatorsArgumentOf(call, 0) ===
      muirMoiraMutatorsFieldOf(optionsPath, 'node') &&
    !muirProteusPlaywrightHasProperty(object, 'response') &&
    muirProteusPlaywrightIsCall(call) &&
    muirMoiraMutatorsMemberNameOf(muirMoiraMutatorsFieldOf(call, 'callee')) ===
      'fulfill' &&
    handlerRouteOf(path, call) !== undefined
  );
}
