import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, it, type TestContext } from 'node:test';

import { muirTestEach } from '@muirjs/madrox-node-test';
import {
  muirSirynNodeTestIsOwn,
  muirSirynNodeTestIsRunning,
  muirSirynNodeTestDirPrefix,
  muirSirynNodeTestOwnDir,
  muirSirynNodeTestRemoveDir,
  muirSirynNodeTestRemoveLeftDirs,
} from '../../src/dirs.ts';
import { logger, noProcess } from '../runner.fixtures.ts';
import { muirSirynNodeTestDryRunDir } from '../../src/dry-run-store.ts';

function tempDirWith(
  t: TestContext,
  prefix: string,
  names: readonly string[] = [],
) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  for (const name of names) {
    mkdirSync(join(dir, name));
  }

  return dir;
}

describe('removeDir', () => {
  const dir = join('/tmp', 'run');

  function removal(t: TestContext, remove: () => Promise<void>) {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const warnings: string[] = [];
    const removed: string[] = [];
    let state = 'pending';
    void muirSirynNodeTestRemoveDir(
      dir,
      logger({ debugEnabled: false, warnings }),
      {
        waitMs: 1_000,
        remove: (path) => {
          removed.push(path);

          return remove();
        },
      },
    ).then(() => (state = 'done'));
    const settled = async () => {
      await new Promise(setImmediate);

      return state;
    };

    return { warnings, removed, settled };
  }

  it('removes the directory without a warning, and stops waiting', async (t) => {
    const { warnings, removed, settled } = removal(t, async () => {});

    assert.equal(await settled(), 'done');

    t.mock.timers.tick(1_000);

    assert.deepEqual([removed, warnings], [[dir], []]);
  });

  it('leaves a directory it cannot remove, with a warning, and stops waiting', async (t) => {
    const { warnings, settled } = removal(t, () =>
      Promise.reject(new Error('EPERM: operation not permitted')),
    );

    assert.equal(await settled(), 'done');

    t.mock.timers.tick(1_000);

    assert.deepEqual(warnings, [
      `Left ${dir} for a later runner to remove: EPERM: operation not permitted`,
    ]);
  });

  it('names what the removal rejected with in the warning, also when it is no Error', async (t) => {
    const reason: unknown = 'EBUSY';
    const { warnings, settled } = removal(t, () => Promise.reject(reason));

    assert.equal(await settled(), 'done');

    t.mock.timers.tick(1_000);

    assert.deepEqual(warnings, [
      `Left ${dir} for a later runner to remove: EBUSY`,
    ]);
  });

  it('stops waiting for a directory still in use after `waitMs`, with a warning', async (t) => {
    const { warnings, settled } = removal(t, () => new Promise(() => {}));
    t.mock.timers.tick(999);

    assert.deepEqual([await settled(), warnings], ['pending', []]);

    t.mock.timers.tick(1);

    assert.deepEqual(
      [await settled(), warnings],
      [
        'done',
        [
          `Stopped waiting for ${dir} to be removed after 1000 ms; a later runner removes what is left.`,
        ],
      ],
    );
  });

  it('leaves no timer holding the process open once the removal settles', async () => {
    const timers = () =>
      process
        .getActiveResourcesInfo()
        .filter((resource) => resource === 'Timeout').length;
    const before = timers();

    await muirSirynNodeTestRemoveDir(
      dir,
      logger({ debugEnabled: false, warnings: [] }),
      {
        waitMs: 5_000,
        remove: async () => {},
      },
    );

    assert.equal(timers(), before);
  });

  it('warns once when the removal fails after it stopped waiting', async (t) => {
    let fail = (_error: Error) => {};
    const { warnings, settled } = removal(
      t,
      () => new Promise((_, reject) => (fail = reject)),
    );
    t.mock.timers.tick(1_000);
    fail(new Error('EBUSY: resource busy or locked'));
    await settled();

    assert.deepEqual(warnings, [
      `Stopped waiting for ${dir} to be removed after 1000 ms; a later runner removes what is left.`,
    ]);
  });
});

describe('isRunning', () => {
  it('tells running processes, also ones it may not signal, from ones that do not run', () => {
    // The system process on Windows and init on POSIX run, and only an administrator may signal them.
    const system = process.platform === 'win32' ? 4 : 1;

    assert.deepEqual(
      [process.pid, system, noProcess].map((pid) =>
        muirSirynNodeTestIsRunning(pid),
      ),
      [true, true, false],
    );
  });

  // As root every signal is allowed, so the real processes above reach EPERM only for other users.
  muirTestEach([
    ['signalled', true, undefined],
    ['refused with EPERM', true, 'EPERM'],
    ['gone with ESRCH', false, 'ESRCH'],
  ])('takes a process %s as running: %s', (_title, expected, code) => {
    const kill = (pid: number, signal: 0) => {
      assert.deepEqual([pid, signal], [42, 0]);

      if (code) {
        throw Object.assign(new Error(code), { code });
      }
    };

    assert.equal(muirSirynNodeTestIsRunning(42, kill), expected);
  });

  muirTestEach([
    ['an Error without a code', new Error('kill failed')],
    ['an object with the code ESRCH that is no Error', { code: 'ESRCH' }],
    ['a string', 'ESRCH'],
  ])(
    'takes a process as running when signalling it throws %s',
    (_title, thrown: unknown) => {
      const kill = () => {
        throw thrown;
      };

      assert.equal(muirSirynNodeTestIsRunning(42, kill), true);
    },
  );
});

describe('ownDir', () => {
  it("creates the directory, and keeps one that is this user's with what it holds", (t) => {
    const dir = join(tempDirWith(t, 'own-dir-'), 'peaks');

    muirSirynNodeTestOwnDir(dir, () => true);
    writeFileSync(join(dir, 'kept'), '');
    muirSirynNodeTestOwnDir(dir, () => true);

    assert.deepEqual(readdirSync(dir), ['kept']);
  });

  it('creates the directory for this user alone', () => {
    const made: unknown[] = [];

    muirSirynNodeTestOwnDir(
      'peaks',
      () => true,
      (path, options) => {
        made.push([path, options]);
      },
    );

    assert.deepEqual(made, [['peaks', { recursive: true, mode: 0o700 }]]);
  });

  it("refuses a directory that is another user's, and names it", (t) => {
    const dir = tempDirWith(t, 'own-dir-');
    const asked: string[] = [];

    assert.throws(
      () => {
        muirSirynNodeTestOwnDir(dir, (path) => {
          asked.push(path);

          return false;
        });
      },
      {
        message: `"${dir}" belongs to another user; remove it, or run Stryker as that user.`,
      },
    );
    assert.deepEqual(asked, [dir]);
  });
});

describe('muirSirynNodeTestDirPrefix', () => {
  const rows: [Parameters<typeof muirSirynNodeTestDirPrefix>[0], string][] = [
    ['run', 'muir-node-test-111-'],
    ['cache', 'muir-node-test-cache-111-'],
    ['dryRun', 'muir-node-test-dry-run-111-'],
  ];

  muirTestEach(rows)(
    'names the %s directories of a process %s',
    (kind, prefix) => {
      assert.equal(muirSirynNodeTestDirPrefix(kind, 111), prefix);
    },
  );
});

describe('removeLeftDirs', () => {
  it('removes the run, cache and dry-run directories whose processes ended, and leaves everything else', (t) => {
    const names = [
      'muir-node-test-111-a',
      'muir-node-test-cache-111-b',
      basename(muirSirynNodeTestDryRunDir(111)),
      'muir-node-test-222-c',
      'muir-node-test-cache-222-d',
      basename(muirSirynNodeTestDryRunDir(222)),
      'muir-node-test-e',
      'other-111-f',
      'other-muir-node-test-111-g',
    ];
    const dir = tempDirWith(t, 'left-dirs-', names);
    const asked: number[] = [];
    muirSirynNodeTestRemoveLeftDirs(dir, {
      running: (pid) => {
        asked.push(pid);

        return pid === 222;
      },
    });

    assert.deepEqual(readdirSync(dir).sort(), names.slice(3).sort());
    assert.deepEqual(asked.sort(), [111, 111, 111, 222, 222, 222]);
  });

  it("leaves the directories of other users' runners", (t) => {
    const names = [
      'muir-node-test-111-mine',
      'muir-node-test-111-theirs',
      'muir-node-test-222-running',
    ];
    const dir = tempDirWith(t, 'left-dirs-', names);
    const asked: string[] = [];
    muirSirynNodeTestRemoveLeftDirs(dir, {
      running: (pid) => pid === 222,
      owned: (path) => {
        asked.push(path);

        return path.endsWith('mine');
      },
    });

    assert.deepEqual(readdirSync(dir).sort(), names.slice(1));
    assert.deepEqual(
      asked.sort(),
      names.slice(0, 2).map((name) => join(dir, name)),
    );
  });

  it('leaves a directory it cannot check or remove yet and goes on with the others', (t) => {
    const names = [
      'muir-node-test-111-a',
      'muir-node-test-111-b',
      'muir-node-test-111-c',
    ];
    const dir = tempDirWith(t, 'left-dirs-', names);
    const removed: string[] = [];

    muirSirynNodeTestRemoveLeftDirs(dir, {
      running: () => false,
      owned: (path) => {
        if (path.endsWith('a')) {
          throw Object.assign(new Error('gone'), { code: 'ENOENT' });
        }

        return true;
      },
      remove: (path) => {
        removed.push(basename(path));
        throw Object.assign(new Error('in use'), { code: 'EBUSY' });
      },
    });

    assert.deepEqual(removed.sort(), names.slice(1));
  });
});

describe('isOwn', () => {
  it("compares the user id of the file itself with this process's", () => {
    const stated: string[] = [];
    const stat = (path: string) => {
      stated.push(path);

      return { uid: 7 };
    };

    assert.deepEqual(
      [
        muirSirynNodeTestIsOwn('a', { getuid: () => 7 }, stat),
        muirSirynNodeTestIsOwn('b', { getuid: () => 8 }, stat),
      ],
      [true, false],
    );
    assert.deepEqual(stated, ['a', 'b']);
  });

  it('counts every file as owned where there are no user ids, as on Windows', () => {
    assert.equal(
      muirSirynNodeTestIsOwn('a', {}, () => assert.fail('looked up the owner')),
      true,
    );
  });

  it('counts a directory this process created as owned', (t) => {
    const dir = tempDirWith(t, 'own-');

    assert.equal(muirSirynNodeTestIsOwn(dir), true);
  });
});
