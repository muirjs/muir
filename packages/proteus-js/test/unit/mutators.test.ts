import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  muirProteusJsMutators,
  muirProteusJsMutatorSets,
} from '../../src/mutators.ts';

describe('jsMutatorSets', () => {
  it('names the default mutators', () => {
    assert.deepEqual(
      muirProteusJsMutatorSets.defaults.map(({ name }) => name),
      [],
    );
  });

  it('names the opt-in mutators', () => {
    assert.deepEqual(
      muirProteusJsMutatorSets.optIn.map(({ name }) => name),
      ['MuirProteusJsNumericLiteral'],
    );
  });

  it('names the experimental mutators', () => {
    assert.deepEqual(
      muirProteusJsMutatorSets.experimental.map(({ name }) => name),
      ['MuirProteusJsAssignmentStatement'],
    );
  });
});

describe('jsMutators', () => {
  it('lists every mutator of the sets', () => {
    assert.deepEqual(muirProteusJsMutators, [
      ...muirProteusJsMutatorSets.defaults,
      ...muirProteusJsMutatorSets.optIn,
      ...muirProteusJsMutatorSets.experimental,
    ]);
  });
});
