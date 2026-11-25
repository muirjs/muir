import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { muirMoiraNodeTestResolveFromCore } from '@muirjs/moira-node-test';
import { muirProteusNodeTestMutators } from '../../src/index.ts';

describe('muirProteusNodeTestMutators', () => {
  it("puts the defaults and the mutators its options turn on in place of Stryker's", async () => {
    await muirProteusNodeTestMutators({
      experimental: { MuirProteusNodeTestCatchAssert: true },
    });

    const names = (await muirMoiraNodeTestResolveFromCore()).allMutators.map(
      ({ name }) => name,
    );

    assert.deepEqual(names, [
      'MuirProteusNodeTestAssertCall',
      'MuirProteusNodeTestAssertValidator',
      'MuirProteusNodeTestCatchAssert',
    ]);
  });

  it('names this package in the error for a mutator its options cannot turn on there', async () => {
    await assert.rejects(
      // @ts-expect-error -- MuirProteusNodeTestCatchAssert is experimental, so it goes inside `experimental`
      muirProteusNodeTestMutators({ MuirProteusNodeTestCatchAssert: true }),
      /^Error: proteus-node-test: /,
    );
  });
});
