import { lzAllMutators, type LzMutatorSets } from '@muirjs/moira-node-test';
import { nodeTestAssertCall } from './node-test-assert-call.ts';
import { nodeTestAssertValidator } from './node-test-assert-validator.ts';
import { nodeTestCatchAssert } from './node-test-catch-assert.ts';

export const testMutatorSets = {
  defaults: [nodeTestAssertCall, nodeTestAssertValidator],
  optIn: [],
  experimental: [nodeTestCatchAssert],
} satisfies LzMutatorSets;

export const testMutators = lzAllMutators(testMutatorSets);
