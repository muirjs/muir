import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type TestContext, test } from 'node:test';

import {
  muirSirynPlaywrightCreateTempRoot,
  muirSirynPlaywrightIsOwnDir,
  muirSirynPlaywrightIsRunning,
  muirSirynPlaywrightNamespaceToken,
  muirSirynPlaywrightOwnerFile,
  muirSirynPlaywrightRemoveLeftRoots,
  muirSirynPlaywrightRootPid,
} from '../src/temp-root.ts';
import { codedError, tempTree } from './support/doubles.ts';

function killError(code: string) {
  return () => {
    throw codedError(code);
  };
}

function directory(uid: number) {
  return () => ({ uid, isDirectory: () => true });
}

test('a root name gives the pid of the runner that made it', () => {
  assert.equal(muirSirynPlaywrightRootPid('muir-playwright-4242-a1B2c3'), 4242);
});

test('names of the old scheme and other folders give no pid', () => {
  assert.equal(muirSirynPlaywrightRootPid('stryker-pw-0-a1B2c3'), undefined);
  assert.equal(
    muirSirynPlaywrightRootPid('muir-playwright-abc-a1B2c3'),
    undefined,
  );
  assert.equal(
    muirSirynPlaywrightRootPid('muir-playwright-x12-a1B2c3'),
    undefined,
  );
  assert.equal(muirSirynPlaywrightRootPid('muir-playwright-'), undefined);
  assert.equal(muirSirynPlaywrightRootPid('other-4242-a1B2c3'), undefined);
  // As long as the prefix, so only the prefix check keeps it out.
  assert.equal(
    muirSirynPlaywrightRootPid('not-a-stryker-root-42-a1B2c3'),
    undefined,
  );
});

test('a name gives a pid only in the shape mkdtemp makes, six letters or digits after the pid', () => {
  assert.equal(muirSirynPlaywrightRootPid('muir-playwright-42-AZaz09'), 42);
  assert.equal(
    muirSirynPlaywrightRootPid('muir-playwright-2024-reports'),
    undefined,
  );
  assert.equal(
    muirSirynPlaywrightRootPid('muir-playwright-1-a1B2c'),
    undefined,
  );
  assert.equal(
    muirSirynPlaywrightRootPid('muir-playwright-1-a1B_c3'),
    undefined,
  );
  assert.equal(
    muirSirynPlaywrightRootPid('muir-playwright-1-a1B2c3-old'),
    undefined,
  );
});

test('a pid too large to be a safe integer is no pid', () => {
  assert.equal(
    muirSirynPlaywrightRootPid('muir-playwright-9007199254740991-a1B2c3'),
    2 ** 53 - 1,
  );
  assert.equal(
    muirSirynPlaywrightRootPid('muir-playwright-9007199254740992-a1B2c3'),
    undefined,
  );
  assert.equal(
    muirSirynPlaywrightRootPid('muir-playwright-12345678901234567890-a1B2c3'),
    undefined,
  );
});

test('on Linux the namespace token is the inode of the pid namespace and the host name', () => {
  const files: string[] = [];
  const token = muirSirynPlaywrightNamespaceToken(
    (file) => {
      files.push(file);

      return 4026531836;
    },
    'ci-host',
    'linux',
  );

  assert.equal(token, '4026531836@ci-host');
  assert.deepEqual(files, ['/proc/self/ns/pid']);
});

test("on Linux without /proc the namespace token is this runner's own, so no other runner matches it", () => {
  assert.equal(
    muirSirynPlaywrightNamespaceToken(
      () => {
        throw codedError('ENOENT');
      },
      'ci-host',
      'linux',
      () => 'b7e4',
    ),
    'b7e4@ci-host',
  );
});

test('outside Linux the namespace token is the host name, and /proc is not looked up', () => {
  const files: string[] = [];

  (['win32', 'darwin'] as const).forEach((platform) => {
    assert.equal(
      muirSirynPlaywrightNamespaceToken(
        (file) => {
          files.push(file);

          return 1;
        },
        'dev-box',
        platform,
      ),
      'dev-box',
    );
  });

  assert.deepEqual(files, []);
});

test('the namespace token of this process names its pid namespace where there is one, and this host', () => {
  const ns = '/proc/self/ns/pid';

  assert.equal(
    muirSirynPlaywrightNamespaceToken(),
    process.platform === 'linux'
      ? `${statSync(ns).ino}@${os.hostname()}`
      : os.hostname(),
  );
});

test('a process that answers signal 0 runs', () => {
  assert.equal(
    muirSirynPlaywrightIsRunning(1, () => undefined),
    true,
  );
});

test('a process that does not exist is not running', () => {
  assert.equal(muirSirynPlaywrightIsRunning(1, killError('ESRCH')), false);
});

test('a process this user may not signal still runs', () => {
  assert.equal(muirSirynPlaywrightIsRunning(1, killError('EPERM')), true);
});

test('a kill that throws no error object leaves the process counted as not running', () => {
  assert.equal(
    muirSirynPlaywrightIsRunning(1, () => {
      throw null;
    }),
    false,
  );
});

test('a real directory with this user as owner is ours', () => {
  assert.equal(
    muirSirynPlaywrightIsOwnDir('d', { getuid: () => 501 }, directory(501)),
    true,
  );
});

test("another user's directory is not ours", () => {
  assert.equal(
    muirSirynPlaywrightIsOwnDir('d', { getuid: () => 501 }, directory(0)),
    false,
  );
});

test('a link or a file is not our directory, even on Windows', () => {
  const link = () => ({ uid: 0, isDirectory: () => false });

  assert.equal(
    muirSirynPlaywrightIsOwnDir('d', { getuid: () => 0 }, link),
    false,
  );
  assert.equal(muirSirynPlaywrightIsOwnDir('d', {}, link), false);
});

test('on Windows, which has no uids, every real directory counts as ours', () => {
  assert.equal(muirSirynPlaywrightIsOwnDir('d', {}, directory(-1)), true);
});

test('a folder that vanished is not ours', () => {
  assert.equal(
    muirSirynPlaywrightIsOwnDir('d', {}, () => {
      throw codedError('ENOENT');
    }),
    false,
  );
});

const ownerToken = 'ns-of-this-runner';

function tmpWith(t: TestContext, names: string[]) {
  const tmp = tempTree(
    t,
    'temp-root-test-',
    Object.fromEntries(
      names.map((name) => [
        path.join(name, muirSirynPlaywrightOwnerFile),
        ownerToken,
      ]),
    ),
  );
  const removed: string[] = [];

  return {
    tmp,
    removed,
    remove: (dir: string) => removed.push(path.basename(dir)),
  };
}

test('a dead root is removed only when its owner marker holds the token of this runner', (t) => {
  const { tmp, removed, remove } = tmpWith(t, [
    'muir-playwright-100-ours00',
    'muir-playwright-101-theirs',
    'muir-playwright-102-nomark',
    'muir-playwright-103-notxt0',
  ]);
  writeFileSync(
    path.join(tmp, 'muir-playwright-101-theirs', muirSirynPlaywrightOwnerFile),
    'ns-of-another-runner',
  );
  rmSync(
    path.join(tmp, 'muir-playwright-102-nomark', muirSirynPlaywrightOwnerFile),
  );
  rmSync(
    path.join(tmp, 'muir-playwright-103-notxt0', muirSirynPlaywrightOwnerFile),
  );
  mkdirSync(
    path.join(tmp, 'muir-playwright-103-notxt0', muirSirynPlaywrightOwnerFile),
  );

  const result = muirSirynPlaywrightRemoveLeftRoots(tmp, {
    running: () => false,
    owned: () => true,
    remove,
    ownPid: 1,
    token: ownerToken,
  });

  assert.deepEqual(result, ['muir-playwright-100-ours00']);
  assert.deepEqual(removed, ['muir-playwright-100-ours00']);
});

test('only the roots of dead runners of this user are removed, and named', (t) => {
  const { tmp, removed, remove } = tmpWith(t, [
    'muir-playwright-100-dead00',
    'muir-playwright-200-live00',
    'muir-playwright-300-own000',
    'muir-playwright-400-other0',
    'stryker-pw-0-old',
    'unrelated-100-x',
  ]);

  const result = muirSirynPlaywrightRemoveLeftRoots(tmp, {
    running: (pid) => pid === 200,
    owned: (dir) => !dir.includes('-400-'),
    remove,
    ownPid: 300,
    token: ownerToken,
  });

  assert.deepEqual(result, ['muir-playwright-100-dead00']);
  assert.deepEqual(removed, ['muir-playwright-100-dead00']);
});

test('a root that cannot be removed now is skipped without an error', (t) => {
  const { tmp } = tmpWith(t, [
    'muir-playwright-100-aaaaaa',
    'muir-playwright-101-bbbbbb',
  ]);

  const result = muirSirynPlaywrightRemoveLeftRoots(tmp, {
    running: () => false,
    owned: () => true,
    remove: (dir) => {
      if (dir.endsWith('-aaaaaa')) {
        throw new Error('EBUSY');
      }
    },
    ownPid: 1,
    token: ownerToken,
  });

  assert.deepEqual(result, ['muir-playwright-101-bbbbbb']);
});

test('a new root is named after the pid of the runner that owns it', (t) => {
  const tmp = tempTree(t, 'temp-root-test-');

  const root = muirSirynPlaywrightCreateTempRoot(tmp, 4242, ownerToken);

  assert.equal(muirSirynPlaywrightRootPid(path.basename(root.dir)), 4242);
  assert.deepEqual(readdirSync(root.dir).sort(), [
    muirSirynPlaywrightOwnerFile,
    'runs',
  ]);
  assert.equal(
    readFileSync(path.join(root.dir, muirSirynPlaywrightOwnerFile), 'utf8'),
    ownerToken,
  );
  assert.deepEqual(
    [root.nextRunDir(), root.nextRunDir()],
    [path.join(root.dir, 'runs', '0'), path.join(root.dir, 'runs', '1')],
  );

  root.remove();

  assert.equal(existsSync(root.dir), false);
});

test('a root whose owner file cannot be written is removed, and the write error is thrown', (t) => {
  const tmp = tempTree(t, 'temp-root-test-');
  const full = codedError('ENOSPC');

  assert.throws(
    () =>
      muirSirynPlaywrightCreateTempRoot(tmp, 4242, ownerToken, () => {
        throw full;
      }),
    (error) => error === full,
  );
  assert.deepEqual(readdirSync(tmp), []);
});
