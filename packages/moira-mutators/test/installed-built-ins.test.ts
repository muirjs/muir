// Own file: node runs each test file in its own process, so the instrumenter's allMutators list is pristine here.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { muirMoiraMutatorsBuiltInNames } from '../src/built-ins.ts';
import {
  muirMoiraMutatorsCorePackageJsons,
  muirMoiraMutatorsResolveInstrumenter,
} from '../src/instrumenter.ts';

function acceptTypes(value: unknown): asserts value is unknown {
  void value;
}

describe('builtInNames', () => {
  it('equals the built-in mutator names of the installed Stryker, so a Stryker upgrade that adds, renames or drops one fails here', async () => {
    const instrumenter = await muirMoiraMutatorsResolveInstrumenter(
      '@muirjs/moira-mutators',
      acceptTypes,
      muirMoiraMutatorsCorePackageJsons()[0],
    );

    assert.deepEqual(
      instrumenter.allMutators.map(({ name }) => name).sort(),
      [...muirMoiraMutatorsBuiltInNames].sort(),
    );
  });
});
