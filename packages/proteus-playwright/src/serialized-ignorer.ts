import { fieldOf, memberNameOf } from '@muirjs/moira-mutators';
import type { Ignorer } from '@stryker-mutator/api/ignore';

import { isFunctionNode } from './ast.ts';

const serializingMethods: readonly unknown[] = [
  'evaluate',
  'evaluateHandle',
  'evaluateAll',
  '$eval',
  '$$eval',
  'addInitScript',
  'waitForFunction',
];

export const serializedIgnorer: Ignorer = {
  shouldIgnore(path) {
    const callee = fieldOf(
      fieldOf(fieldOf(path, 'parentPath'), 'node'),
      'callee',
    );
    const method = memberNameOf(callee);

    if (
      isFunctionNode(fieldOf(path, 'node')) &&
      serializingMethods.includes(method)
    ) {
      return `lz-playwright-serialized: Playwright's ${String(method)} runs this function's source text where Stryker's helpers do not exist`;
    }

    return undefined;
  },
};
