import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  muirSirynPlaywrightHookTestNamespaceEnv,
  muirSirynPlaywrightParseSnapshotLine,
  muirSirynPlaywrightReadHookTestNamespace,
  muirSirynPlaywrightReadRunSettings,
  muirSirynPlaywrightReadSnapshotDir,
  muirSirynPlaywrightRunSettingsEnv,
  muirSirynPlaywrightSerializeSnapshot,
} from '../src/protocol.ts';
import { tempTree, withoutPrototypes } from './support/doubles.ts';

test('a snapshot with a BigInt hit count is written as a lost frame', () => {
  const line = muirSirynPlaywrightSerializeSnapshot({
    hitCount: 1n,
    outlivedItsTest: true,
  });

  assert.deepEqual(JSON.parse(line), { lost: true, outlivedItsTest: true });
  assert.equal(muirSirynPlaywrightParseSnapshotLine(line)?.lost, true);
});

test('a snapshot with cyclic coverage is written as a lost frame', () => {
  const cyclic: Record<string, unknown> = {};
  cyclic['self'] = cyclic;

  assert.deepEqual(
    JSON.parse(
      muirSirynPlaywrightSerializeSnapshot({
        mutantCoverage: cyclic,
        outlivedItsTest: true,
      }),
    ),
    {
      lost: true,
      outlivedItsTest: true,
    },
  );
});

test('a line that is cut off or not an object is skipped', () => {
  assert.equal(
    muirSirynPlaywrightParseSnapshotLine('{"mutantCoverage":{"sta'),
    undefined,
  );
  assert.equal(muirSirynPlaywrightParseSnapshotLine('3'), undefined);
  assert.equal(muirSirynPlaywrightParseSnapshotLine('null'), undefined);
});

test('a parsed line sets every flag and a valid hit count', () => {
  assert.deepEqual(muirSirynPlaywrightParseSnapshotLine('{}'), {
    coverage: undefined,
    hitCount: 0,
    outlivedItsTest: false,
    lost: false,
    instrumented: false,
  });
  assert.equal(
    muirSirynPlaywrightParseSnapshotLine('{"hitCount":-1}')?.hitCount,
    0,
  );
  assert.equal(
    muirSirynPlaywrightParseSnapshotLine('{"hitCount":"3"}')?.hitCount,
    0,
  );
  assert.equal(
    muirSirynPlaywrightParseSnapshotLine('{"hitCount":7}')?.hitCount,
    7,
  );
  assert.equal(
    muirSirynPlaywrightParseSnapshotLine('{"instrumented":1}')?.instrumented,
    false,
  );
  assert.deepEqual(
    muirSirynPlaywrightParseSnapshotLine(
      '{"lost":true,"outlivedItsTest":true,"instrumented":true}',
    ),
    {
      coverage: undefined,
      hitCount: 0,
      outlivedItsTest: true,
      lost: true,
      instrumented: true,
    },
  );
});

test('a parsed line keeps no coverage that is not a map', () => {
  assert.equal(
    muirSirynPlaywrightParseSnapshotLine('{"mutantCoverage":3}')?.coverage,
    undefined,
  );
  assert.deepEqual(
    withoutPrototypes(
      muirSirynPlaywrightParseSnapshotLine(
        '{"mutantCoverage":{"static":3,"perTest":{"a":3}}}',
      )?.coverage,
    ),
    { static: {}, perTest: { a: {} } },
  );
});

test("the hooks' namespace is Stryker's unless the environment names a test namespace", () => {
  assert.equal(muirSirynPlaywrightReadHookTestNamespace({}), '__stryker__');
  assert.equal(
    muirSirynPlaywrightReadHookTestNamespace({
      [muirSirynPlaywrightHookTestNamespaceEnv]: '',
    }),
    '__stryker__',
  );
  assert.equal(
    muirSirynPlaywrightReadHookTestNamespace({
      [muirSirynPlaywrightHookTestNamespaceEnv]: '__test__',
    }),
    '__test__',
  );
});

test('the run settings are read from the environment, with a hit limit only when one is set', () => {
  assert.equal(muirSirynPlaywrightReadRunSettings({}), undefined);
  assert.deepEqual(
    muirSirynPlaywrightReadRunSettings({
      [muirSirynPlaywrightRunSettingsEnv]: '{"outDir":"out","perTest":true}',
    }),
    { outDir: 'out', perTest: true },
  );
  assert.deepEqual(
    muirSirynPlaywrightReadRunSettings({
      [muirSirynPlaywrightRunSettingsEnv]:
        '{"outDir":"out","perTest":false,"hitLimit":5}',
    }),
    { outDir: 'out', perTest: false, hitLimit: 5 },
  );
  assert.deepEqual(
    muirSirynPlaywrightReadRunSettings({
      [muirSirynPlaywrightRunSettingsEnv]:
        '{"outDir":"out","perTest":true,"testIdHosts":["localhost:1"]}',
    }),
    { outDir: 'out', perTest: true, testIdHosts: ['localhost:1'] },
  );
});

test("the run settings carry the init script with Stryker's page helpers", () => {
  assert.deepEqual(
    muirSirynPlaywrightReadRunSettings({
      [muirSirynPlaywrightRunSettingsEnv]:
        '{"outDir":"out","perTest":true,"pageHelpers":"h();"}',
    }),
    { outDir: 'out', perTest: true, pageHelpers: 'h();' },
  );
});

test("a run folder's server snapshots merge with the workers', but only a worker file shows the worker hook installed", (t) => {
  const line = (testId: string) =>
    muirSirynPlaywrightSerializeSnapshot({
      mutantCoverage: { static: {}, perTest: { [testId]: { '1': 1 } } },
      outlivedItsTest: false,
    });
  const serverOnly = tempTree(t, 'protocol-dir-', {
    'server-1-a.ndjson': line('a') + '\n',
  });
  const both = tempTree(t, 'protocol-dir-', {
    'server-1-a.ndjson': line('a') + '\n',
    'worker-2-b.ndjson': line('b') + '\n',
  });

  assert.equal(
    muirSirynPlaywrightReadSnapshotDir(serverOnly).hookInstalled,
    false,
  );
  assert.equal(
    muirSirynPlaywrightReadSnapshotDir(serverOnly).snapshots.length,
    1,
  );
  assert.equal(muirSirynPlaywrightReadSnapshotDir(both).hookInstalled, true);
  assert.equal(muirSirynPlaywrightReadSnapshotDir(both).snapshots.length, 2);
});

test('a run folder names each mutant the server snapshots cover once, static or per test, and none a worker covers', (t) => {
  const line = (mutantCoverage: unknown) =>
    muirSirynPlaywrightSerializeSnapshot({
      mutantCoverage,
      outlivedItsTest: false,
    }) + '\n';
  const dir = tempTree(t, 'protocol-dir-', {
    'server-1-a.ndjson':
      line({ static: { '1': 1 }, perTest: { a: { '2': 1 } } }) +
      line({ static: {}, perTest: { b: { '2': 1, '3': 1 } } }),
    'server-2-b.ndjson':
      line({ static: { '4': 1 }, perTest: {} }) + line(undefined),
    'worker-3-c.ndjson': line({
      static: { '5': 1 },
      perTest: { a: { '6': 1 } },
    }),
  });

  assert.deepEqual(
    [...muirSirynPlaywrightReadSnapshotDir(dir).serverMutants].sort(),
    ['1', '2', '3', '4'],
  );
});

test('run settings that are not JSON, not an object or have a field of the wrong type are refused', () => {
  [
    '{oops',
    'null',
    '[]',
    '{"perTest":true}',
    '{"outDir":"out"}',
    '{"outDir":"out","perTest":"true"}',
    '{"outDir":"out","perTest":true,"hitLimit":"5"}',
    '{"outDir":"out","perTest":true,"testIdHosts":"localhost:1"}',
    '{"outDir":"out","perTest":true,"testIdHosts":[1]}',
    '{"outDir":"out","perTest":true,"pageHelpers":1}',
  ].forEach((raw) => {
    assert.throws(
      () =>
        muirSirynPlaywrightReadRunSettings({
          [muirSirynPlaywrightRunSettingsEnv]: raw,
        }),
      {
        message: `${muirSirynPlaywrightRunSettingsEnv} holds no valid run settings: ${raw}`,
      },
    );
  });
});

test('run settings that are not JSON are refused with the parse error as the cause', () => {
  assert.throws(
    () =>
      muirSirynPlaywrightReadRunSettings({
        [muirSirynPlaywrightRunSettingsEnv]: '{oops',
      }),
    (error) => error instanceof Error && error.cause instanceof SyntaxError,
  );
});
