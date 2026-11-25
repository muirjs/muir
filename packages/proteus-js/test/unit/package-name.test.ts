import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { muirMoiraMutatorsResolveBabelInstrumenter } from '@muirjs/moira-mutators';
import {
  muirProteusJsPackageName,
  muirProteusJsTestedVersion,
} from '../../src/package-name.ts';
import pkg from '../../package.json' with { type: 'json' };

describe('muirProteusJsPackageName', () => {
  it('is the name in package.json', () => {
    assert.equal(muirProteusJsPackageName, pkg.name);
  });
});

describe('muirProteusJsTestedVersion', () => {
  it('is the version of the instrumenter that the tests run', async () => {
    const { version } = await muirMoiraMutatorsResolveBabelInstrumenter(
      muirProteusJsPackageName,
    );

    assert.equal(muirProteusJsTestedVersion, version);
  });

  it('is the version the README names', () => {
    const readme = readFileSync(
      new URL('../../README.md', import.meta.url),
      'utf8',
    ).replaceAll(/\s+/g, ' ');

    assert.ok(readme.includes(`is tested with ${muirProteusJsTestedVersion}`));
  });
});
