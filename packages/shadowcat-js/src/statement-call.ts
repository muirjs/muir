import {
  muirMoiraMutatorsCallTypes,
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsIsRecord,
  muirMoiraMutatorsMemberTypes,
} from '@muirjs/moira-mutators';

import { muirShadowcatJsTypeOf } from './type-of.ts';

const effectTypes: readonly unknown[] = [
  ...muirMoiraMutatorsCallTypes,
  'ArrowFunctionExpression',
  'AssignmentExpression',
  'AwaitExpression',
  'ClassMethod',
  'ClassPrivateMethod',
  'Decorator',
  'FunctionExpression',
  'ImportExpression',
  'NewExpression',
  'ObjectMethod',
  'TaggedTemplateExpression',
  'ThrowStatement',
  'UpdateExpression',
  'YieldExpression',
];

const effectOperators: readonly unknown[] = ['delete', 'throw', '|>'];

export function muirShadowcatJsHideableCallee(
  node: unknown,
): string | undefined {
  if (muirShadowcatJsTypeOf(node) !== 'ExpressionStatement') {
    return undefined;
  }

  const expression = muirMoiraMutatorsFieldOf(node, 'expression');
  const call =
    muirShadowcatJsTypeOf(expression) === 'AwaitExpression' ||
    muirMoiraMutatorsFieldOf(expression, 'operator') === 'void'
      ? muirMoiraMutatorsFieldOf(expression, 'argument')
      : expression;

  if (
    !muirMoiraMutatorsCallTypes.includes(muirShadowcatJsTypeOf(call)) ||
    holdsEffect(muirMoiraMutatorsFieldOf(call, 'arguments'))
  ) {
    return undefined;
  }

  return dottedName(muirMoiraMutatorsFieldOf(call, 'callee'));
}

function holdsEffect(node: unknown): boolean {
  return (
    effectTypes.includes(muirShadowcatJsTypeOf(node)) ||
    effectOperators.includes(muirMoiraMutatorsFieldOf(node, 'operator')) ||
    (muirMoiraMutatorsIsRecord(node) && Object.values(node).some(holdsEffect))
  );
}

function dottedName(node: unknown): string | undefined {
  if (muirShadowcatJsTypeOf(node) === 'Identifier') {
    return String(muirMoiraMutatorsFieldOf(node, 'name'));
  }

  if (
    !muirMoiraMutatorsMemberTypes.includes(muirShadowcatJsTypeOf(node)) ||
    muirMoiraMutatorsFieldOf(node, 'computed')
  ) {
    return undefined;
  }

  const object = dottedName(muirMoiraMutatorsFieldOf(node, 'object'));

  return (
    object &&
    `${object}.${String(muirMoiraMutatorsFieldOf(muirMoiraMutatorsFieldOf(node, 'property'), 'name'))}`
  );
}
