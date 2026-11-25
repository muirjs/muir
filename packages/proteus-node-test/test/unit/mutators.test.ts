import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  muirProteusNodeTestTestMutators,
  muirProteusNodeTestTestMutatorSets,
} from '../../src/mutators.ts';

describe('testMutatorSets', () => {
  it('names the default test-code mutators', () => {
    assert.deepEqual(
      muirProteusNodeTestTestMutatorSets.defaults.map(({ name }) => name),
      [
        'MuirProteusNodeTestAssertCall',
        'MuirProteusNodeTestAssertValidator',
        'MuirProteusNodeTestCatchAssert',
      ],
    );
  });

  it('has no opt-in test-code mutators', () => {
    assert.deepEqual(muirProteusNodeTestTestMutatorSets.optIn, []);
  });

  it('has no experimental test-code mutators', () => {
    assert.deepEqual(muirProteusNodeTestTestMutatorSets.experimental, []);
  });
});

describe('testMutators', () => {
  it('lists every mutator of the sets', () => {
    assert.deepEqual(muirProteusNodeTestTestMutators, [
      ...muirProteusNodeTestTestMutatorSets.defaults,
      ...muirProteusNodeTestTestMutatorSets.optIn,
      ...muirProteusNodeTestTestMutatorSets.experimental,
    ]);
  });
});
