import {
  muirMoiraMutatorsArgumentOf,
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsMemberNameOf,
  muirMoiraMutatorsPropertyKey,
} from '@muirjs/moira-mutators';

import {
  muirProteusPlaywrightIsRequestContext,
  muirProteusPlaywrightOutermost,
  muirProteusPlaywrightUnwrapped,
} from './ast.ts';
import type { MuirProteusPlaywrightMutator } from './mutators.ts';

const payloadKeys: readonly unknown[] = ['data', 'form', 'params'];
const payloadMethods: readonly unknown[] = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'fetch',
];

export function muirProteusPlaywrightRequestDataMutator<
  const TName extends string,
>(
  name: TName,
  sample: string,
): MuirProteusPlaywrightMutator & { readonly name: TName } {
  return {
    name,
    sample,
    *mutate(path, t) {
      if (!inPayload(path)) {
        return;
      }

      const node = muirMoiraMutatorsFieldOf(path, 'node');
      const value = muirMoiraMutatorsFieldOf(node, 'value');
      const type = muirMoiraMutatorsFieldOf(node, 'type');

      if (type === 'StringLiteral') {
        yield t.stringLiteral(`${String(value)}x`);
      }

      if (type === 'NumericLiteral') {
        yield t.numericLiteral(Number(value) + 1);
      }

      if (type === 'BooleanLiteral') {
        yield t.booleanLiteral(value !== true);
      }
    },
  };
}

/** `path` sits, through object values and array elements, inside the object that is the value of a payload property. */
function inPayload(path: unknown): boolean {
  const outer = muirProteusPlaywrightOutermost(path);

  if (muirMoiraMutatorsFieldOf(outer, 'key') === 'value') {
    const property = muirMoiraMutatorsFieldOf(outer, 'parentPath');

    return (
      (muirMoiraMutatorsFieldOf(
        muirProteusPlaywrightUnwrapped(muirMoiraMutatorsFieldOf(outer, 'node')),
        'type',
      ) === 'ObjectExpression' &&
        isPayload(property)) ||
      inPayload(muirMoiraMutatorsFieldOf(property, 'parentPath'))
    );
  }

  return (
    muirMoiraMutatorsFieldOf(
      muirMoiraMutatorsFieldOf(outer, 'parent'),
      'type',
    ) === 'ArrayExpression' &&
    inPayload(muirMoiraMutatorsFieldOf(outer, 'parentPath'))
  );
}

/** A payload property of the options argument of a request call. */
function isPayload(propertyPath: unknown): boolean {
  const optionsPath = muirProteusPlaywrightOutermost(
    muirMoiraMutatorsFieldOf(propertyPath, 'parentPath'),
  );
  const call = muirMoiraMutatorsFieldOf(optionsPath, 'parent');

  return (
    payloadKeys.includes(
      muirMoiraMutatorsPropertyKey(
        muirMoiraMutatorsFieldOf(propertyPath, 'node'),
      ),
    ) &&
    muirMoiraMutatorsArgumentOf(call, 1) ===
      muirMoiraMutatorsFieldOf(optionsPath, 'node') &&
    isPayloadCall(optionsPath, call)
  );
}

function isPayloadCall(path: unknown, call: unknown): boolean {
  const callee = muirMoiraMutatorsFieldOf(call, 'callee');

  return (
    muirProteusPlaywrightIsRequestContext(
      path,
      muirMoiraMutatorsFieldOf(callee, 'object'),
    ) && payloadMethods.includes(muirMoiraMutatorsMemberNameOf(callee))
  );
}
