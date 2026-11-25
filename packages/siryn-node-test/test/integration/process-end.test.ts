import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { describe, it } from 'node:test';

import {
  muirSirynNodeTestEndGroup,
  muirSirynNodeTestGroupOptions,
  muirSirynNodeTestTermGraceMs,
} from '../../src/process-end.ts';

describe('endGroup', () => {
  it(
    'stops waiting once a group that SIGTERM ends is gone, before the time it gives the group',
    {
      // eslint-disable-next-line node-test/no-skip-test -- POSIX only, with the reason as its value
      skip:
        process.platform === 'win32' &&
        'Windows has no signals to catch: every kill is TerminateProcess',
    },
    async (t) => {
      const child = spawn(
        process.execPath,
        ['-e', 'setInterval(() => {}, 1_000);'],
        {
          ...muirSirynNodeTestGroupOptions(process.platform),
          stdio: 'ignore',
        },
      );
      t.after(() => {
        child.kill('SIGKILL');
      });
      await once(child, 'spawn');
      const { pid } = child;
      assert.ok(pid, 'The child process started without a pid.');
      const exited = once(child, 'exit');

      const started = performance.now();
      await muirSirynNodeTestEndGroup(pid, process.platform, (target, signal) =>
        process.kill(target, signal),
      );
      const waitedMs = performance.now() - started;
      await exited;

      // Stryker disable next-line MuirProteusNodeTestAssertCall: runs on POSIX only, where the Linux run of this test checks it
      assert.equal(child.signalCode, 'SIGTERM');
      // Stryker disable next-line MuirProteusNodeTestAssertCall: runs on POSIX only, where the Linux run of this test checks it
      assert.ok(waitedMs < muirSirynNodeTestTermGraceMs, `${waitedMs} ms`);
    },
  );
});
