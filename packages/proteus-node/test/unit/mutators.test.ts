import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  muirProteusNodeMutators,
  muirProteusNodeMutatorSets,
} from '../../src/mutators.ts';

describe('nodeMutatorSets', () => {
  it('names the default mutators', () => {
    assert.deepEqual(
      muirProteusNodeMutatorSets.defaults.map(({ name }) => name),
      [
        'MuirProteusNodeTimerDelay',
        'MuirProteusNodeEventName',
        'MuirProteusNodeAwaitStatement',
        'MuirProteusNodeReturnAwait',
        'MuirProteusNodeExitCode',
      ],
    );
  });

  it('names the opt-in mutators', () => {
    assert.deepEqual(
      muirProteusNodeMutatorSets.optIn.map(({ name }) => name),
      ['MuirProteusNodeAssertStatement', 'MuirProteusNodeListenerOnce'],
    );
  });

  it('names the experimental mutators', () => {
    assert.deepEqual(
      muirProteusNodeMutatorSets.experimental.map(({ name }) => name),
      ['MuirProteusNodeByteLength', 'MuirProteusNodeCallbackError'],
    );
  });
});

describe('nodeMutators', () => {
  it('lists every mutator of the sets', () => {
    assert.deepEqual(muirProteusNodeMutators, [
      ...muirProteusNodeMutatorSets.defaults,
      ...muirProteusNodeMutatorSets.optIn,
      ...muirProteusNodeMutatorSets.experimental,
    ]);
  });
});
