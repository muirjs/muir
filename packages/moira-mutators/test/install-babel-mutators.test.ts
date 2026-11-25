// Own file: node runs each test file in its own process, so the install changes this process's instrumenter only.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  muirMoiraMutatorsInstallBabelMutators,
  muirMoiraMutatorsResolveBabelInstrumenter,
  type MuirMoiraMutatorsBabelMutator,
} from '../src/babel-mutator.ts';

const packageName = '@muirjs/babel-sample-mutators';
const mutator: MuirMoiraMutatorsBabelMutator = {
  name: 'MuirBabelSampleEmptyString',
  sample: "export const word = 'muir';\n",
  *mutate(path, t) {
    if (path.isStringLiteral() && path.node.value === 'muir') {
      yield t.stringLiteral('');
    }
  },
};

describe('installBabelMutators through the installed core', () => {
  it('installs into the instrumenter of the core that runs this process, without a warning', async (t) => {
    const warn = t.mock.method(console, 'warn', () => undefined);

    await muirMoiraMutatorsInstallBabelMutators({
      packageName,
      installName: 'muirBabelSampleMutators',
      testedVersion: '10.1.1',
      sets: { defaults: [mutator], optIn: [], experimental: [] },
      options: undefined,
    });

    const instrumenter =
      await muirMoiraMutatorsResolveBabelInstrumenter(packageName);
    const mutants = await instrumenter.instrument([
      { name: 'word.ts', content: "export const word = 'muir';\n" },
    ]);

    assert.ok(mutants.some(({ mutatorName }) => mutatorName === mutator.name));
    assert.equal(warn.mock.callCount(), 0);
  });
});
