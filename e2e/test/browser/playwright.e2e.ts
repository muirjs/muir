import assert from 'node:assert/strict';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { it } from 'node:test';

import {
  muirConcurrency,
  muirInstallPacked,
  muirLeftover,
  muirMutants,
  muirPack,
  muirRemoveDeadRunDirs,
  muirRemoveOnExit,
  muirStryker,
} from '../../src/fixture.ts';

const { MUIR_E2E_STRYKER: stryker } = process.env;

if (stryker === undefined || !/^\d+\.\d+\.\d+$/.test(stryker)) {
  throw new Error(
    `Set MUIR_E2E_STRYKER to the @stryker-mutator/core version the fixture installs, such as 10.0.0. It is ${stryker === undefined ? 'unset' : `"${stryker}"`}.`,
  );
}

const concurrency = muirConcurrency(process.env);
const dirPrefix = 'muir-playwright-e2e-';

muirRemoveDeadRunDirs(tmpdir(), dirPrefix);
const dir = realpathSync.native(
  mkdtempSync(join(tmpdir(), `${dirPrefix}${process.pid}-`)),
);

muirRemoveOnExit(dir);
cpSync(join(import.meta.dirname, '..', '..', 'fixtures', 'playwright'), dir, {
  recursive: true,
});
mkdirSync(join(dir, 'tmp'));

// Only the runner and the one core version: the mutator packages and the TypeScript checker peer on core 10.1.
const tarballs = await muirPack(join(dir, 'tarballs'));

await muirInstallPacked(
  dir,
  tarballs.filter((tarball) =>
    /^muirjs-siryn-playwright-\d/.test(basename(tarball)),
  ),
  undefined,
  [`@stryker-mutator/core@${stryker}`],
);

const run = await muirStryker(dir, 'stryker.config.mjs', concurrency);

it(`installs @stryker-mutator/core ${stryker}`, () => {
  const manifest = readFileSync(
    join(dir, 'node_modules', '@stryker-mutator', 'core', 'package.json'),
    'utf8',
  );

  assert.ok(
    manifest.includes(`"version": "${stryker}"`),
    `The installed core is not ${stryker}: ${/"version": "[^"]*"/.exec(manifest)?.[0] ?? manifest}`,
  );
});

it('mutates the page code and runs each mutant with the Playwright tests', () => {
  assert.deepEqual(muirMutants(run, 'src/counter.ts'), [
    '1:55 BlockStatement {} Killed',
    '3:41 StringLiteral "" Killed',
    '4:41 StringLiteral "" Killed',
    '6:24 StringLiteral "" Killed',
    '8:27 StringLiteral "" Killed',
    '8:42 BlockStatement {} Killed',
    '9:5 AssignmentOperator count -= 1 Killed',
    '10:26 ConditionalExpression false Killed',
    '10:26 ConditionalExpression true Killed',
    '10:26 EqualityOperator count <= 2 Killed',
    '10:26 EqualityOperator count >= 2 Survived',
    '10:38 StringLiteral "" Killed',
    '12:3 CallExpression ; Killed',
  ]);
});

it('leaves only the caches of Playwright and Node.js in its temporary directory', () => {
  // Both caches are kept across runs on purpose; anything else is a folder the runner failed to remove.
  assert.deepEqual(muirLeftover(run), [
    'node-compile-cache',
    'playwright-transform-cache',
  ]);
});
