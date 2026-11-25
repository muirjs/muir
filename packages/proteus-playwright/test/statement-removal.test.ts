import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { muirProteusPlaywrightMutatorSets } from '../src/mutators.ts';
import { muirProteusPlaywrightStatementRemovals } from '../src/statement-removal.ts';

const rosterNames: readonly string[] = Object.values(
  muirProteusPlaywrightMutatorSets,
)
  .flat()
  .map(({ name }) => name);

describe('statementRemovals', () => {
  it('maps every method to a mutator of the roster', () => {
    const unknown = Object.entries(muirProteusPlaywrightStatementRemovals)
      .filter(([, { mutator }]) => !rosterNames.includes(mutator))
      .map(([method]) => method);

    assert.deepEqual(unknown, []);
  });

  it('gives every Action mutator at least one method', () => {
    const used = new Set(
      Object.values(muirProteusPlaywrightStatementRemovals).map(
        ({ mutator }) => mutator,
      ),
    );
    const idle = rosterNames.filter(
      (name) => name.endsWith('Action') && !used.has(name),
    );

    assert.deepEqual(idle, []);
  });
});
