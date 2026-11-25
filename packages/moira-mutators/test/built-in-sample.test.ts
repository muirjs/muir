// Own file: node runs each test file in its own process, so the instrumenter's allMutators list is pristine here.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  muirMoiraMutatorsBuiltInNames,
  muirMoiraMutatorsBuiltInSample,
} from '../src/built-ins.ts';
import {
  muirMoiraMutatorsCorePackageJson,
  muirMoiraMutatorsResolveInstrumenter,
} from '../src/instrumenter.ts';

function acceptTypes(value: unknown): asserts value is unknown {
  void value;
}

describe('builtInSample', () => {
  it('makes a mutant of each of the 17 built-ins before any is removed, so the check that none remains can fail', async () => {
    const instrumenter = await muirMoiraMutatorsResolveInstrumenter(
      '@muirjs/moira-mutators',
      acceptTypes,
      muirMoiraMutatorsCorePackageJson(),
    );

    const mutants = await instrumenter.instrument([
      {
        name: 'built-ins.self-check.tsx',
        content: muirMoiraMutatorsBuiltInSample,
      },
    ]);

    assert.deepEqual(
      muirMoiraMutatorsBuiltInNames.filter(
        (name) => !mutants.some(({ mutatorName }) => mutatorName === name),
      ),
      [],
    );
  });
});
