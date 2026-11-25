import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { type TestContext, test } from 'node:test';

import type { MuirSirynPlaywrightStrykerNamespace } from '../src/namespace.ts';
import {
  muirSirynPlaywrightReadSnapshotDir,
  muirSirynPlaywrightSnapshotSuffix,
} from '../src/protocol.ts';
import { muirSirynPlaywrightMergeCoverage } from '../src/run-result.ts';
import {
  muirSirynPlaywrightControlFile,
  type MuirSirynPlaywrightServerControl,
  muirSirynPlaywrightServerSnapshotPrefix,
  muirSirynPlaywrightWriteServerControl,
} from '../src/server-protocol.ts';
import { muirSirynPlaywrightRunSwitch } from '../src/server-run-switch.ts';
import { tempTree, withoutPrototypes } from './support/doubles.ts';

function switched(t: TestContext) {
  const dir = tempTree(t, 'server-run-switch-');
  const namespace: MuirSirynPlaywrightStrykerNamespace = {};
  const run = muirSirynPlaywrightRunSwitch(
    dir,
    namespace,
    `${muirSirynPlaywrightServerSnapshotPrefix}1-x${muirSirynPlaywrightSnapshotSuffix}`,
  );
  let runs = 0;

  return {
    dir,
    namespace,
    run,
    write(control: Omit<MuirSirynPlaywrightServerControl, 'outDir'>) {
      const outDir = path.join(dir, 'runs', String(runs++));
      mkdirSync(outDir, { recursive: true });
      muirSirynPlaywrightWriteServerControl(dir, { outDir, ...control });

      return outDir;
    },
  };
}

function hitsOf(outDir: string): number {
  return muirSirynPlaywrightReadSnapshotDir(outDir).snapshots.reduce(
    (sum, { hitCount }) => sum + hitCount,
    0,
  );
}

test('a request activates the mutant of the control file, and none before there is one', (t) => {
  const { namespace, run, write } = switched(t);

  run.startRequest();

  assert.equal(namespace.activeMutant, undefined);
  assert.equal(run.control(), undefined);

  write({ perTest: false, activeMutant: '2' });
  run.startRequest();

  assert.equal(namespace.activeMutant, '2');

  write({ perTest: false });
  run.startRequest();

  assert.equal(namespace.activeMutant, undefined);
});

test('the issued test ids are those of the current control file only', (t) => {
  const { run, write } = switched(t);
  write({ perTest: true, issuedTestIds: ['big', 'small'] });
  run.startRequest();
  write({ perTest: true, issuedTestIds: ['small', 'tall'] });
  run.startRequest();

  assert.deepEqual(
    ['big', 'small', 'tall'].map((testId) => run.isIssued(testId)),
    [false, true, true],
  );
});

test('a control rewritten for the same run folder is the control a later request sees', (t) => {
  const { dir, run, write } = switched(t);
  const outDir = write({ perTest: true, testIdHosts: ['localhost:4200'] });
  run.startRequest();
  muirSirynPlaywrightWriteServerControl(dir, {
    outDir,
    perTest: true,
    testIdHosts: ['localhost:4300'],
  });
  run.startRequest();

  assert.deepEqual(run.control()?.testIdHosts, ['localhost:4300']);
});

test('a control file that is gone leaves no control, not the previous run', (t) => {
  const { dir, namespace, run, write } = switched(t);
  write({ perTest: false, activeMutant: '2' });
  run.startRequest();
  rmSync(path.join(dir, muirSirynPlaywrightControlFile));
  run.startRequest();

  assert.equal(run.control(), undefined);
  assert.equal(namespace.activeMutant, undefined);
});

test('a control file that cannot be read keeps the previous control, and warns once', (t) => {
  const { dir, namespace, run, write } = switched(t);
  const emitWarning = t.mock.method(process, 'emitWarning', () => undefined);
  write({ perTest: false, activeMutant: '2' });
  run.startRequest();
  rmSync(path.join(dir, muirSirynPlaywrightControlFile));
  mkdirSync(path.join(dir, muirSirynPlaywrightControlFile));
  run.startRequest();
  run.startRequest();

  assert.equal(namespace.activeMutant, '2');
  assert.equal(run.control()?.activeMutant, '2');
  assert.equal(emitWarning.mock.callCount(), 1);
  assert.match(
    String(emitWarning.mock.calls[0]?.arguments[0]),
    /control\.json/,
  );
});

test('an invalid control file leaves no control, not the previous run, and warns once', (t) => {
  const { dir, namespace, run, write } = switched(t);
  const emitWarning = t.mock.method(process, 'emitWarning', () => undefined);
  write({ perTest: false, activeMutant: '2' });
  run.startRequest();
  writeFileSync(path.join(dir, muirSirynPlaywrightControlFile), '{"outDir":');
  run.startRequest();
  run.startRequest();

  assert.equal(run.control(), undefined);
  assert.equal(namespace.activeMutant, undefined);
  assert.equal(emitWarning.mock.callCount(), 1);
  assert.match(
    String(emitWarning.mock.calls[0]?.arguments[0]),
    /control\.json/,
  );
});

test("a run's hit count counts only the hits in that run", (t) => {
  const { namespace, run, write } = switched(t);
  const first = write({ perTest: false, activeMutant: '7', hitLimit: 10 });
  run.startRequest();

  assert.equal(namespace.hitLimit, 10);
  assert.equal(namespace.hitCount, 0);

  namespace.hitCount = 1;
  run.flush();
  run.startRequest();
  namespace.hitCount = 2;
  run.flush();
  const second = write({ perTest: false, activeMutant: '7', hitLimit: 10 });
  run.startRequest();
  namespace.hitCount = 1;
  run.flush();

  assert.equal(hitsOf(first), 2);
  assert.equal(hitsOf(second), 1);
});

test('coverage before the first run goes to the first run, and each run gets only its own hits', (t) => {
  const { namespace, run, write } = switched(t);
  const coverage: {
    readonly static: Record<string, number>;
    readonly perTest: Record<string, Record<string, number>>;
  } = { static: { '0': 1 }, perTest: {} };
  namespace.mutantCoverage = coverage;
  run.startRequest();
  run.flush();
  const first = write({ perTest: true });
  run.startRequest();
  coverage.perTest['small'] = { '7': 1 };
  run.flush();
  const second = write({ perTest: true });
  run.startRequest();
  coverage.perTest['small'] = { '7': 1 };
  run.flush();

  assert.deepEqual(
    withoutPrototypes(
      muirSirynPlaywrightMergeCoverage(
        muirSirynPlaywrightReadSnapshotDir(first).snapshots,
      ),
    ),
    { static: { '0': 1 }, perTest: { small: { '7': 1 } } },
  );
  assert.deepEqual(
    withoutPrototypes(
      muirSirynPlaywrightMergeCoverage(
        muirSirynPlaywrightReadSnapshotDir(second).snapshots,
      ),
    ),
    { static: {}, perTest: { small: { '7': 1 } } },
  );
});

test('a valid control file, a changed one and a removed one warn nothing', (t) => {
  const { dir, run, write } = switched(t);
  const emitWarning = t.mock.method(process, 'emitWarning', () => undefined);
  write({ perTest: false, activeMutant: '2' });
  run.startRequest();
  write({ perTest: false, activeMutant: '3' });
  run.startRequest();
  rmSync(path.join(dir, muirSirynPlaywrightControlFile));
  run.startRequest();

  assert.equal(emitWarning.mock.callCount(), 0);
});

test('a run without a hit limit counts no hits', (t) => {
  const { namespace, run, write } = switched(t);
  write({ perTest: false, activeMutant: '7', hitLimit: 10 });
  run.startRequest();
  write({ perTest: false, activeMutant: '7' });
  run.startRequest();

  assert.deepEqual(
    [namespace.hitLimit, namespace.hitCount],
    [undefined, undefined],
  );
});

test('a flush writes only what was hit since the last one, and nothing when nothing was', (t) => {
  const { namespace, run, write } = switched(t);
  const coverage: {
    readonly static: Record<string, number>;
    readonly perTest: Record<string, Record<string, number>>;
  } = { static: {}, perTest: {} };
  namespace.mutantCoverage = coverage;
  const outDir = write({ perTest: true });
  run.startRequest();
  run.flush();
  coverage.perTest['small'] = { '7': 1 };
  run.flush();
  run.flush();

  assert.deepEqual(
    muirSirynPlaywrightReadSnapshotDir(outDir).snapshots.map(({ coverage }) =>
      withoutPrototypes(coverage),
    ),
    [{ static: {}, perTest: { small: { '7': 1 } } }],
  );
});

test('a flush writes static coverage without per-test coverage', (t) => {
  const { namespace, run, write } = switched(t);
  namespace.mutantCoverage = { static: { '0': 1 }, perTest: {} };
  const outDir = write({ perTest: true });
  run.startRequest();
  run.flush();

  assert.deepEqual(
    withoutPrototypes(
      muirSirynPlaywrightMergeCoverage(
        muirSirynPlaywrightReadSnapshotDir(outDir).snapshots,
      ),
    ),
    { static: { '0': 1 }, perTest: {} },
  );
});

test('a flush tells the run that the server loaded instrumented code, though no mutant was reached', (t) => {
  const { namespace, run, write } = switched(t);
  namespace.instrumented = true;
  const outDir = write({ perTest: false });
  run.startRequest();
  run.flush();

  assert.deepEqual(
    muirSirynPlaywrightReadSnapshotDir(outDir).snapshots.map(
      ({ instrumented }) => instrumented,
    ),
    [true],
  );
});

test('each run hears once that the server loaded instrumented code', (t) => {
  const { namespace, run, write } = switched(t);
  namespace.instrumented = true;
  const runs = [write({ perTest: false })];
  run.startRequest();
  run.flush();
  run.flush();
  runs.push(write({ perTest: false }));
  run.startRequest();
  run.flush();
  run.flush();

  assert.deepEqual(
    runs.map(
      (outDir) => muirSirynPlaywrightReadSnapshotDir(outDir).snapshots.length,
    ),
    [1, 1],
  );
});

test('a run folder that is gone drops the coverage without a throw', (t) => {
  const { dir, namespace, run } = switched(t);
  muirSirynPlaywrightWriteServerControl(dir, {
    outDir: path.join(dir, 'gone'),
    perTest: true,
  });
  run.startRequest();
  namespace.mutantCoverage = { static: {}, perTest: { small: { '7': 1 } } };

  assert.doesNotThrow(() => run.flush());
});
