import assert from 'node:assert/strict';
import { it } from 'node:test';

import { builtInNames } from '@layzee/stryker-mutator-install';

import { builtInReasons } from '../src/built-in-reasons.ts';

it("gives a reason for each of Stryker's 17 built-ins, in the order of the built-in list, and for no other name", () => {
  assert.deepEqual(Object.keys(builtInReasons), builtInNames);
});

it('gives each reason as a sentence', () => {
  for (const [name, reason] of Object.entries(builtInReasons)) {
    assert.match(reason, /^[A-Z].*\.$/, name);
  }
});
