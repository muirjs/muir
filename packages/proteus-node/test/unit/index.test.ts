import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { muirMoiraNodeTestResolveFromCore } from '@muirjs/moira-node-test';
import { muirProteusNodeMutators } from '../../src/index.ts';

describe('muirProteusNodeMutators', () => {
  it("installs the defaults and the mutators its options turn on into Stryker's instrumenter", async () => {
    await muirProteusNodeMutators({
      MuirProteusNodeListenerOnce: true,
      experimental: { MuirProteusNodeByteLength: true },
    });

    const names = (await muirMoiraNodeTestResolveFromCore()).allMutators.map(
      ({ name }) => name,
    );

    assert.deepEqual(
      [
        'MuirProteusNodeTimerDelay',
        'MuirProteusNodeListenerOnce',
        'MuirProteusNodeByteLength',
        'MuirProteusNodeAssertStatement',
        'MuirProteusNodeCallbackError',
      ].map((name) => names.includes(name)),
      [true, true, true, false, false],
    );
  });

  it('names this package in the error for a mutator its options cannot turn on there', async () => {
    await assert.rejects(
      // @ts-expect-error -- MuirProteusNodeByteLength is experimental, so it goes inside `experimental`
      muirProteusNodeMutators({ MuirProteusNodeByteLength: true }),
      /^Error: proteus-node: /,
    );
  });
});
