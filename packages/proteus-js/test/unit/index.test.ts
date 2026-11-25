import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { muirMoiraNodeTestResolveFromCore } from '@muirjs/moira-node-test';
import { muirProteusJsMutators } from '../../src/index.ts';

describe('muirProteusJsMutators', () => {
  it("installs the mutators its options turn on into Stryker's instrumenter", async () => {
    await muirProteusJsMutators({ MuirProteusJsNumericLiteral: true });

    const names = (await muirMoiraNodeTestResolveFromCore()).allMutators.map(
      ({ name }) => name,
    );

    assert.deepEqual(
      ['MuirProteusJsNumericLiteral', 'MuirProteusJsAssignmentStatement'].map(
        (name) => names.includes(name),
      ),
      [true, false],
    );
  });

  it('names this package in the error for a mutator its options cannot turn on there', async () => {
    await assert.rejects(
      // @ts-expect-error -- MuirProteusJsAssignmentStatement is experimental, so it goes inside `experimental`
      muirProteusJsMutators({ MuirProteusJsAssignmentStatement: true }),
      /^Error: proteus-js: /,
    );
  });
});
