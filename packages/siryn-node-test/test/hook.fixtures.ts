import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';

import { hookUrl, reporterArg } from './runner.fixtures.ts';
import {
  muirSirynNodeTestEnvNames,
  muirSirynNodeTestParseRecord,
  muirSirynNodeTestParseRecordName,
  type MuirSirynNodeTestRecordName,
  type MuirSirynNodeTestProcessRecord,
} from '../src/record.ts';

export function tempDir(t: TestContext): string {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'hook-test-')));
  t.after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  return dir;
}

/** It keeps Stryker's active mutant, so a mutant in hook.ts reaches the process that loads it. */
export function hookedEnv(env: Record<string, string>): NodeJS.ProcessEnv {
  const dropped: string[] = [
    'NODE_OPTIONS',
    'NODE_TEST_CONTEXT',
    ...Object.values(muirSirynNodeTestEnvNames),
  ];
  const base = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !dropped.includes(key)),
  );

  return { ...base, ...env };
}

export async function runWithHook(
  args: string[],
  env: Record<string, string>,
): Promise<{ code: number | null; pid: number }> {
  const child = spawn(
    process.execPath,
    ['--import', hookUrl, reporterArg, ...args],
    {
      env: hookedEnv(env),
      stdio: 'ignore',
      windowsHide: true,
    },
  );

  await once(child, 'close');

  if (child.pid === undefined) {
    throw new Error('The child process started without a pid.');
  }

  return { code: child.exitCode, pid: child.pid };
}

export function readRecords(
  outDir: string,
): Record<string, MuirSirynNodeTestProcessRecord> {
  return Object.fromEntries(
    readdirSync(outDir).map((name) => [
      name,
      muirSirynNodeTestParseRecord(readFileSync(join(outDir, name), 'utf8')),
    ]),
  );
}

/** The record that the process `pid` wrote from `thread`, by its name. */
export function recordOf(
  records: Record<string, MuirSirynNodeTestProcessRecord>,
  pid: number,
  thread: MuirSirynNodeTestRecordName['thread'],
): MuirSirynNodeTestProcessRecord | undefined {
  return Object.entries(records).find(([name]) => {
    const parsed = muirSirynNodeTestParseRecordName(name);

    return parsed?.pid === pid && parsed.thread === thread;
  })?.[1];
}

export async function runTestFile(
  t: TestContext,
  source: string,
  {
    name = 'fixture.test.mjs',
    dir = tempDir(t),
    env = {},
    args = [],
  }: {
    name?: string;
    dir?: string;
    env?: Record<string, string>;
    args?: string[];
  } = {},
) {
  const outDir = tempDir(t);
  const testFile = join(dir, name);
  writeFileSync(testFile, source);

  const { code, pid } = await runWithHook([...args, testFile], {
    [muirSirynNodeTestEnvNames.out]: outDir,
    [muirSirynNodeTestEnvNames.file]: testFile,
    ...env,
  });
  const records = readRecords(outDir);

  return { code, pid, testFile, records, record: recordOf(records, pid, 0) };
}
