import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { muirMoiraMutatorsResolveBabelInstrumenter } from '@muirjs/moira-mutators';
import { muirProteusNodeTestMutators } from '../../src/index.ts';
import { muirProteusNodeTestPackageName } from '../../src/package-name.ts';

describe('muirProteusNodeTestMutators', () => {
  it("puts the defaults in place of Stryker's, without a warning", async (t) => {
    const warn = t.mock.method(console, 'warn', () => undefined);

    await muirProteusNodeTestMutators();

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

  it('names itself in the error for any option, as it has no opt-in or experimental mutators', async () => {
    await assert.rejects(
      // @ts-expect-error -- this package has no experimental mutators, so its options have no experimental
      muirProteusNodeTestMutators({ experimental: true }),
      {
        message:
          '@muirjs/proteus-node-test: the package has no opt-in or experimental mutators yet, so ' +
          'muirProteusNodeTestMutators() takes no options. Turn a mutator off with mutator.excludedMutations.',
      },
    );
  });
});
