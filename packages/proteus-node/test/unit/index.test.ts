import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { muirMoiraMutatorsResolveBabelInstrumenter } from '@muirjs/moira-mutators';
import { muirProteusNodeMutators } from '../../src/index.ts';
import { muirProteusNodePackageName } from '../../src/package-name.ts';

describe('muirProteusNodeMutators', () => {
  it("installs the defaults and the mutators its options turn on beside Stryker's, without a warning", async (t) => {
    const warn = t.mock.method(console, 'warn', () => undefined);

    await muirProteusNodeMutators({
      MuirProteusNodeAssertStatement: true,
      experimental: { MuirProteusNodeListenerOnce: true },
    });

    const names = (
      await muirMoiraMutatorsResolveBabelInstrumenter(
        muirProteusNodePackageName,
      )
    ).allMutators.map(({ name }) => name);

    assert.deepEqual(
      [
        [
          'StringLiteral',
          'MuirProteusNodeTimerDelay',
          'MuirProteusNodeAssertStatement',
          'MuirProteusNodeListenerOnce',
          'MuirProteusNodeByteLength',
          'MuirProteusNodeCallbackError',
        ].map((name) => names.includes(name)),
        warn.mock.callCount(),
      ],
      [[true, true, true, true, false, false], 0],
    );
  });

  it('names this package in the error for a mutator its options cannot turn on there', async () => {
    await assert.rejects(
      // @ts-expect-error -- MuirProteusNodeByteLength is experimental, so it goes inside `experimental`
      muirProteusNodeMutators({ MuirProteusNodeByteLength: true }),
      /^Error: @muirjs\/proteus-node: /,
    );
  });
});
