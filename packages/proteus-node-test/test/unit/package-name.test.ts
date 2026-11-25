import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { muirMoiraMutatorsResolveBabelInstrumenter } from '@muirjs/moira-mutators';
import {
  muirProteusNodeTestPackageName,
  muirProteusNodeTestTestedVersion,
} from '../../src/package-name.ts';
import pkg from '../../package.json' with { type: 'json' };

describe('muirProteusNodeTestPackageName', () => {
  it('is the name in package.json', () => {
    assert.equal(muirProteusNodeTestPackageName, pkg.name);
  });
});

describe('muirProteusNodeTestTestedVersion', () => {
  it('is the version of the instrumenter that the tests run', async () => {
    const { version } = await muirMoiraMutatorsResolveBabelInstrumenter(
      muirProteusNodeTestPackageName,
    );

    assert.equal(muirProteusNodeTestTestedVersion, version);
  });

  it('is the version the README names', () => {
    const readme = readFileSync(
      new URL('../../README.md', import.meta.url),
      'utf8',
    ).replaceAll(/\s+/g, ' ');

    assert.ok(
      readme.includes(`is tested with ${muirProteusNodeTestTestedVersion}`),
    );
  });
});
