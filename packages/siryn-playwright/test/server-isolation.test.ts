import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';

import {
  muirSirynPlaywrightReadServerMutantsFile,
  muirSirynPlaywrightRestartsToIsolate,
  muirSirynPlaywrightStartupMutantFor,
  muirSirynPlaywrightWriteServerMutantsFile,
} from '../src/server-isolation.ts';
import { dryRequest, mutantRequest, tempTree } from './support/doubles.ts';

test('the webServer starts with the mutant of a statically activated mutant run, and with none otherwise', () => {
  const unknown = () => 'unknown' as const;

  assert.equal(
    muirSirynPlaywrightStartupMutantFor(
      mutantRequest({ activeMutant: '7', mutantActivation: 'static' }),
      unknown,
    ),
    '7',
  );
  assert.equal(
    muirSirynPlaywrightStartupMutantFor(
      mutantRequest({ activeMutant: '7', mutantActivation: 'runtime' }),
      unknown,
    ),
    undefined,
  );
  assert.equal(
    muirSirynPlaywrightStartupMutantFor(dryRequest(), unknown),
    undefined,
  );
});

test('the webServer starts with a static mutant only when the dry run saw the server reach it', () => {
  const run = (activeMutant: string) =>
    muirSirynPlaywrightStartupMutantFor(
      mutantRequest({ activeMutant, mutantActivation: 'static' }),
      () => new Set(['2']),
    );

  assert.deepEqual([run('2'), run('3')], ['2', undefined]);
});

test('a run that is not a server run, after another such run, keeps the webServer', () => {
  assert.equal(
    muirSirynPlaywrightRestartsToIsolate(true, 'other', 'other'),
    false,
  );
});

test('a server run restarts the webServer after a run that is not one', () => {
  assert.equal(
    muirSirynPlaywrightRestartsToIsolate(true, 'other', 'server'),
    true,
  );
});

test('a run after a server run restarts the webServer, so the server run leaves no state behind', () => {
  assert.equal(
    muirSirynPlaywrightRestartsToIsolate(true, 'server', 'other'),
    true,
  );
});

test('a server run after a server run restarts the webServer', () => {
  assert.equal(
    muirSirynPlaywrightRestartsToIsolate(true, 'server', 'server'),
    true,
  );
});

test('isolate false never restarts the webServer to isolate a run', () => {
  const kinds = ['server', 'other'] as const;

  assert.deepEqual(
    kinds.flatMap((previous) =>
      kinds.map((next) =>
        muirSirynPlaywrightRestartsToIsolate(false, previous, next),
      ),
    ),
    [false, false, false, false],
  );
});

test('another process reads the server mutants the dry run process wrote to the shared folder', (t) => {
  const dir = tempTree(t, 'server-mutants-');

  muirSirynPlaywrightWriteServerMutantsFile(dir, ['2', '4']);

  assert.deepEqual(muirSirynPlaywrightReadServerMutantsFile(dir), {
    mutants: new Set(['2', '4']),
  });
});

test('a dry run whose server ran no mutant leaves an empty set', (t) => {
  const dir = tempTree(t, 'server-mutants-');

  muirSirynPlaywrightWriteServerMutantsFile(dir, []);

  assert.deepEqual(muirSirynPlaywrightReadServerMutantsFile(dir), {
    mutants: new Set(),
  });
});

test('a write leaves only the finished file, so a reader never sees it half written', (t) => {
  const dir = tempTree(t, 'server-mutants-');

  muirSirynPlaywrightWriteServerMutantsFile(dir, ['2']);
  muirSirynPlaywrightWriteServerMutantsFile(dir, ['4']);

  assert.deepEqual(readdirSync(dir), ['.muir-playwright-server-mutants']);
  assert.deepEqual(muirSirynPlaywrightReadServerMutantsFile(dir), {
    mutants: new Set(['4']),
  });
});

test('a write that never finished is not read', (t) => {
  const dir = tempTree(t, 'server-mutants-', {
    '.muir-playwright-server-mutants.0b1c': '2\n',
  });

  assert.ok('cause' in muirSirynPlaywrightReadServerMutantsFile(dir));
});

test('a folder without the file gives the cause instead of server mutants', (t) => {
  const dir = tempTree(t, 'server-mutants-');

  const result = muirSirynPlaywrightReadServerMutantsFile(dir);

  assert.ok('cause' in result);
  assert.match(result.cause, /ENOENT.*\.muir-playwright-server-mutants/);
});
