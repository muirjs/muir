import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, type TestContext } from 'node:test';

import { muirTestFor } from '@muirjs/madrox-node-test';
import {
  muirSirynNodeTestDryRunStore,
  muirSirynNodeTestOwnDryRun,
} from '../../src/dry-run-store.ts';
import { muirSirynNodeTestEnvNames } from '../../src/record.ts';

function setup(t: TestContext) {
  const parent = mkdtempSync(join(tmpdir(), 'dry-run-store-'));
  t.after(() => {
    rmSync(parent, { recursive: true, force: true });
  });
  const dir = join(parent, 'dry-run');
  const store = muirSirynNodeTestDryRunStore(dir);
  store.start();

  return { dir, store };
}

describe('muirSirynNodeTestDryRunStore', () => {
  it('starts empty, whatever an earlier run left in its directory', (t) => {
    const { dir, store } = setup(t);
    store.write('a.test.ts', 'peak', '370');
    store.write('a.test.ts', 'start-up', '{"startUpMs":401,"tests":5}');
    mkdirSync(join(dir, 'left'));
    writeFileSync(join(dir, 'left', 'other'), 'x');

    muirSirynNodeTestDryRunStore(dir).start();

    assert.deepEqual(
      [
        readdirSync(dir),
        store.read('a.test.ts', 'peak'),
        store.read('a.test.ts', 'start-up'),
      ],
      [[], undefined, undefined],
    );
  });

  it('reads back what it wrote, apart for each file and each kind', (t) => {
    const { store } = setup(t);
    store.write('a.test.ts', 'peak', '370');
    store.write('a.test.ts', 'start-up', '{"startUpMs":401,"tests":5}');
    store.write('b.test.ts', 'peak', '120');

    assert.deepEqual(
      [
        store.read('a.test.ts', 'peak'),
        store.read('a.test.ts', 'start-up'),
        store.read('b.test.ts', 'peak'),
      ],
      ['370', '{"startUpMs":401,"tests":5}', '120'],
    );
  });

  it('reads nothing of a file and kind that it did not write', (t) => {
    const { store } = setup(t);
    store.write('a.test.ts', 'peak', '370');

    assert.deepEqual(
      [store.read('a.test.ts', 'start-up'), store.read('b.test.ts', 'peak')],
      [undefined, undefined],
    );
  });
});

describe('muirSirynNodeTestOwnDryRun', () => {
  function inherit(t: TestContext, owner: string): void {
    const before = process.env[muirSirynNodeTestEnvNames.dryRunOwner];
    t.after(() => {
      if (before === undefined) {
        Reflect.deleteProperty(
          process.env,
          muirSirynNodeTestEnvNames.dryRunOwner,
        );
      } else {
        process.env[muirSirynNodeTestEnvNames.dryRunOwner] = before;
      }
    });
    process.env[muirSirynNodeTestEnvNames.dryRunOwner] = owner;
  }

  it('returns the owner its parent process passed on, and keeps it', (t) => {
    inherit(t, String(process.ppid));

    assert.equal(muirSirynNodeTestOwnDryRun(), process.ppid);
    assert.equal(
      process.env[muirSirynNodeTestEnvNames.dryRunOwner],
      String(process.ppid),
    );
  });

  muirTestFor<readonly [string]>([
    [''],
    ['not a pid'],
    ['0'],
    ['-4242'],
    ['42.5'],
    ['1e999'],
    [String(process.ppid + 1)],
  ])(
    'owns the dry run itself when the owner passed on reads %j',
    ([owner], t) => {
      inherit(t, owner);

      assert.equal(muirSirynNodeTestOwnDryRun(), process.pid);
      assert.equal(
        process.env[muirSirynNodeTestEnvNames.dryRunOwner],
        String(process.pid),
      );
    },
  );
});
