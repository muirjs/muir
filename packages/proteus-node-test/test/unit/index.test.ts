import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { muirMoiraMutatorsResolveBabelInstrumenter } from '@muirjs/moira-mutators';
import { muirProteusNodeTestMutators } from '../../src/index.ts';
import { muirProteusNodeTestPackageName } from '../../src/package-name.ts';

describe('muirProteusNodeTestMutators', () => {
  it("puts the defaults and the mutators its options turn on in place of Stryker's, without a warning", async (t) => {
    const warn = t.mock.method(console, 'warn', () => undefined);

    await muirProteusNodeTestMutators({
      experimental: { MuirProteusNodeTestCatchAssert: true },
    });

    const names = (
      await muirMoiraMutatorsResolveBabelInstrumenter(
        muirProteusNodeTestPackageName,
      )
    ).allMutators.map(({ name }) => name);

    assert.deepEqual(
      [names, warn.mock.callCount()],
      [
        [
          'MuirProteusNodeTestAssertCall',
          'MuirProteusNodeTestAssertValidator',
          'MuirProteusNodeTestCatchAssert',
        ],
        0,
      ],
    );
  });

  it('names this package in the error for a mutator its options cannot turn on there', async () => {
    await assert.rejects(
      // @ts-expect-error -- MuirProteusNodeTestCatchAssert is experimental, so it goes inside `experimental`
      muirProteusNodeTestMutators({ MuirProteusNodeTestCatchAssert: true }),
      /^Error: @muirjs\/proteus-node-test: /,
    );
  });

  it('names itself in the error for extended, as it has no opt-in mutators', async () => {
    await assert.rejects(
      // @ts-expect-error -- this package has no opt-in mutators, so its options have no extended
      muirProteusNodeTestMutators({ extended: true }),
      {
        message:
          '@muirjs/proteus-node-test: the package has no opt-in mutators yet, so muirProteusNodeTestMutators() ' +
          'takes no extended option.',
      },
    );
  });
});
