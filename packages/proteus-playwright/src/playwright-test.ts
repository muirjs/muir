import { muirMoiraMutatorsFieldOf } from '@muirjs/moira-mutators';

import {
  muirProteusPlaywrightIsCall,
  muirProteusPlaywrightIsTestCallee,
} from './ast.ts';

export function muirProteusPlaywrightLooksLikePlaywrightTest(
  program: unknown,
): boolean {
  const body = muirMoiraMutatorsFieldOf(program, 'body');

  return (
    Array.isArray(body) &&
    body.some(
      (statement) =>
        isPlaywrightImport(statement) || isTopLevelTestCall(statement),
    )
  );
}

function isPlaywrightImport(statement: unknown): boolean {
  const source = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsFieldOf(statement, 'source'),
    'value',
  );

  return (
    muirMoiraMutatorsFieldOf(statement, 'type') === 'ImportDeclaration' &&
    String(source).startsWith('@playwright/')
  );
}

function isTopLevelTestCall(statement: unknown): boolean {
  const call = muirMoiraMutatorsFieldOf(statement, 'expression');

  return (
    muirMoiraMutatorsFieldOf(statement, 'type') === 'ExpressionStatement' &&
    muirProteusPlaywrightIsCall(call) &&
    muirProteusPlaywrightIsTestCallee(muirMoiraMutatorsFieldOf(call, 'callee'))
  );
}
