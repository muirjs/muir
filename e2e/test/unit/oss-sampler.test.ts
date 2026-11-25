import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { describe, it, type TestContext } from 'node:test';

import {
  muirParseProcSamples,
  muirParseSamples,
} from '../../src/oss/processes.ts';
import {
  muirProcessReader,
  muirSnapshot,
  muirStartSampler,
  type MuirProcessReader,
} from '../../src/oss/sampler.ts';

const oneSample = "process.stdout.write('7 1 100 5 a\\n--\\n');";
const row = { pid: 7, ppid: 1, workingSetBytes: 100, created: 5n, name: 'a' };

/** A reader whose scripts Node.js runs, so a test can make the sampler fail as a real one could. */
function nodeReader(script: string): MuirProcessReader {
  return {
    command: process.execPath,
    args: ['-e'],
    sample: script,
    loop: script,
    parse: muirParseSamples,
  };
}

/** Makes a flag file once the script has written, so a test can stop the sampler after that and not before. */
function flagged(
  t: TestContext,
  script: string,
): { readonly script: string; readonly written: () => Promise<void> } {
  const dir = mkdtempSync(join(tmpdir(), 'muir-sampler-'));
  const flag = join(dir, 'written');

  t.after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  return {
    script: `${script} require('node:fs').writeFileSync(${JSON.stringify(flag)}, ''); setInterval(() => {}, 1000);`,
    written: async () => {
      for (let tries = 0; tries < 500 && !existsSync(flag); tries++) {
        await setTimeout(20);
      }
    },
  };
}

describe('muirSnapshot', () => {
  it("lists this process under its parent, read by this platform's own script", async () => {
    const sample = await muirSnapshot();

    assert.deepEqual(
      sample
        .filter(({ pid }) => pid === process.pid)
        .map(({ pid, ppid }) => ({ pid, ppid })),
      [{ pid: process.pid, ppid: process.ppid }],
    );
  });

  it('refuses a sample whose script wrote an error, though it exited with 0', async () => {
    const reader = nodeReader(
      `process.stderr.write('Get-CimInstance failed'); ${oneSample}`,
    );

    await assert.rejects(muirSnapshot(reader), {
      message:
        'The process snapshot failed with exit code 0:\nGet-CimInstance failed',
    });
  });

  it('refuses a sample whose script exited with an error code, though it wrote no error', async () => {
    await assert.rejects(
      muirSnapshot(nodeReader(`${oneSample} process.exitCode = 3;`)),
      {
        message: 'The process snapshot failed with exit code 3:\n',
      },
    );
  });
});

describe('muirProcessReader', () => {
  it('reads /proc through sh on Linux, and Win32_Process through pwsh on Windows', () => {
    const platforms: readonly NodeJS.Platform[] = ['linux', 'win32'];

    assert.deepEqual(
      platforms.map((platform) => {
        const { command, args, parse } = muirProcessReader(platform);

        return { command, args, parse };
      }),
      [
        { command: 'sh', args: ['-c'], parse: muirParseProcSamples },
        {
          command: 'pwsh',
          args: ['-NoProfile', '-NonInteractive', '-Command'],
          parse: muirParseSamples,
        },
      ],
    );
  });

  it('refuses a platform that has neither', () => {
    assert.throws(() => muirProcessReader('darwin'), {
      message:
        'The process sampler reads Win32_Process or /proc; darwin has neither.',
    });
  });
});

describe('muirStartSampler', () => {
  it('keeps the samples taken before its script wrote an error, and reports the error', async (t) => {
    const { script, written } = flagged(
      t,
      `${oneSample} process.stderr.write('CIM timed out');`,
    );
    const sampler = await muirStartSampler(nodeReader(script));

    await written();

    assert.deepEqual(await sampler.stop(), {
      samples: [[row]],
      error: 'The process sampler failed:\nCIM timed out',
    });
  });

  it(
    'keeps the samples of a sampler that ended before the stop, and reports that it ended',
    { timeout: 10_000 },
    async () => {
      const sampler = await muirStartSampler(nodeReader(oneSample));

      await sampler.ended;

      assert.deepEqual(await sampler.stop(), {
        samples: [[row]],
        error: 'The process sampler ended early, with exit code 0.',
      });
    },
  );

  it('reports no error for a sampler that ran until the stop', async (t) => {
    const { script, written } = flagged(t, oneSample);
    const sampler = await muirStartSampler(nodeReader(script));

    await written();

    assert.deepEqual(await sampler.stop(), { samples: [[row]], error: null });
  });

  it("samples with this platform's own loop until the stop", async () => {
    const sampler = await muirStartSampler();

    await setTimeout(3_000);

    assert.equal((await sampler.stop()).error, null);
  });

  it('joins output that arrives in pieces', { timeout: 10_000 }, async () => {
    const sampler = await muirStartSampler(
      nodeReader(
        "process.stdout.write('7 1 100 5 a\\n'); process.stderr.write('CIM ');" +
          " setTimeout(() => { process.stdout.write('--\\n'); process.stderr.write('timed out'); }, 200);",
      ),
    );

    await sampler.ended;

    assert.deepEqual(await sampler.stop(), {
      samples: [[row]],
      error: 'The process sampler failed:\nCIM timed out',
    });
  });

  it(
    'gives its script no input, so a script that reads to the end of its input goes on',
    { timeout: 10_000 },
    async () => {
      const sampler = await muirStartSampler(
        nodeReader(`process.stdin.on('end', () => { ${oneSample} }).resume();`),
      );

      await sampler.ended;

      assert.deepEqual(await sampler.stop(), {
        samples: [[row]],
        error: 'The process sampler ended early, with exit code 0.',
      });
    },
  );

  it(
    'keeps what a process its script started writes after the script ended',
    { timeout: 10_000 },
    async () => {
      const late = `setTimeout(() => { ${oneSample} }, 1000);`;
      const sampler = await muirStartSampler(
        nodeReader(
          `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(late)}], ` +
            "{ stdio: ['ignore', 'inherit', 'ignore'], windowsHide: true, detached: true }).unref();",
        ),
      );

      await sampler.ended;

      assert.deepEqual(await sampler.stop(), {
        samples: [[row]],
        error: 'The process sampler ended early, with exit code 0.',
      });
    },
  );

  it('rejects when its shell cannot start, such as with no pwsh on PATH', async () => {
    const reader = {
      ...nodeReader(oneSample),
      command: 'muir-no-such-command',
    };

    await assert.rejects(muirStartSampler(reader), { code: 'ENOENT' });
  });
});
