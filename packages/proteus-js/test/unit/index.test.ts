import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { muirMoiraMutatorsResolveBabelInstrumenter } from '@muirjs/moira-mutators';
import { muirProteusJsMutators } from '../../src/index.ts';
import { muirProteusJsPackageName } from '../../src/package-name.ts';

describe('muirProteusJsMutators', () => {
  it("installs the mutators its options turn on beside Stryker's, without a warning", async (t) => {
    const warn = t.mock.method(console, 'warn', () => undefined);

    await muirProteusJsMutators({ MuirProteusJsNumericLiteral: true });

    const names = (
      await muirMoiraMutatorsResolveBabelInstrumenter(muirProteusJsPackageName)
    ).allMutators.map(({ name }) => name);

    assert.deepEqual(
      [
        [
          'StringLiteral',
          'MuirProteusJsNumericLiteral',
          'MuirProteusJsAssignmentStatement',
        ].map((name) => names.includes(name)),
        warn.mock.callCount(),
      ],
      [[true, true, false], 0],
    );
  });

  it('names this package in the error for a mutator its options cannot turn on there', async () => {
    await assert.rejects(
      // @ts-expect-error -- MuirProteusJsAssignmentStatement is experimental, so it goes inside `experimental`
      muirProteusJsMutators({ MuirProteusJsAssignmentStatement: true }),
      /^Error: @muirjs\/proteus-js: /,
    );
  });
});
