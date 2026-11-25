import {
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsMemberNameOf,
} from '@muirjs/moira-mutators';
import type { Ignorer } from '@stryker-mutator/api/ignore';

import { muirProteusPlaywrightIsFunctionNode } from './ast.ts';

const serializingMethods: readonly unknown[] = [
  'evaluate',
  'evaluateHandle',
  'evaluateAll',
  '$eval',
  '$$eval',
  'addInitScript',
  'waitForFunction',
];

export const muirProteusPlaywrightSerializedIgnorer: Ignorer = {
  shouldIgnore(path) {
    const callee = muirMoiraMutatorsFieldOf(
      muirMoiraMutatorsFieldOf(
        muirMoiraMutatorsFieldOf(path, 'parentPath'),
        'node',
      ),
      'callee',
    );
    const method = muirMoiraMutatorsMemberNameOf(callee);

    if (
      muirProteusPlaywrightIsFunctionNode(
        muirMoiraMutatorsFieldOf(path, 'node'),
      ) &&
      serializingMethods.includes(method)
    ) {
      return `muir-proteus-playwright-serialized: Playwright's ${String(method)} runs this function's source text where Stryker's helpers do not exist`;
    }

    return undefined;
  },
};
