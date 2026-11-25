import assert from 'node:assert/strict';
import { it } from 'node:test';

import { muirMoiraMutatorsBuiltInNames } from '@muirjs/moira-mutators';

import { muirProteusStorybookTestBuiltInReasons } from '../src/built-in-reasons.ts';

it("gives a reason for each of Stryker's 17 built-ins, in the order of the built-in list, and for no other name", () => {
  assert.deepEqual(
    Object.keys(muirProteusStorybookTestBuiltInReasons),
    muirMoiraMutatorsBuiltInNames,
  );
});

it('gives each reason as a sentence', () => {
  for (const [name, reason] of Object.entries(
    muirProteusStorybookTestBuiltInReasons,
  )) {
    assert.match(reason, /^[A-Z].*\.$/, name);
  }
});
