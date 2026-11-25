import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { muirSirynNodeTestDirPrefix, muirSirynNodeTestOwnDir } from './dirs.ts';
import { muirSirynNodeTestEnvNames } from './record.ts';

/**
 * Where the runners of one Stryker run keep which test files the dry run ran, which mutants it reached outside every
 * test, and what it measured of each file: its memory peak and its start-up. Stryker runs the dry run in one worker and
 * the mutants in all of them, each a process it forks and may replace, so the directory is named after the process
 * that owns it (see `muirSirynNodeTestOwnDryRun`).
 */
export function muirSirynNodeTestDryRunDir(ownerPid: number): string {
  return join(
    tmpdir(),
    `${muirSirynNodeTestDirPrefix('dryRun', ownerPid)}store`,
  );
}

/**
 * The pid of the process that owns the dry-run store: the first process to load this module that did not inherit its
 * parent's pid as the owner. Stryker imports every plugin in its own process before it forks a worker, and each worker
 * inherits its environment, so in a Stryker run the owner is Stryker's own process; a test that builds runners owns
 * them itself. Any other inherited value, such as one exported in a shell or passed on by a grandparent, is not taken,
 * so two runs never share a store. The owner removes the directory when it exits. A killed owner leaves it to a later
 * runner's `removeLeftDirs`.
 */
export function muirSirynNodeTestOwnDryRun(): number {
  if (
    process.env[muirSirynNodeTestEnvNames.dryRunOwner] === String(process.ppid)
  ) {
    return process.ppid;
  }

  process.env[muirSirynNodeTestEnvNames.dryRunOwner] = String(process.pid);
  process.once('exit', () => {
    try {
      rmSync(muirSirynNodeTestDryRunDir(process.pid), { recursive: true });
    } catch {
      // Left for a later runner's removeLeftDirs.
    }
  });

  return process.pid;
}

/**
 * What the dry run keeps of a test file, each in a file of its own, and, as `files` and `outside-tests`, the test files
 * it ran and the mutants it reached outside every test.
 */
export type MuirSirynNodeTestDryRunKind =
  | 'peak'
  | 'start-up'
  | 'files'
  | 'outside-tests';

export interface MuirSirynNodeTestDryRunStore {
  /** Creates the directory for this user alone, or empties the one that exists. */
  start(): void;
  write(file: string, kind: MuirSirynNodeTestDryRunKind, content: string): void;
  /** What `write` kept, or undefined when there is none or it cannot be read. */
  read(file: string, kind: MuirSirynNodeTestDryRunKind): string | undefined;
}

export function muirSirynNodeTestDryRunStore(
  dir: string,
): MuirSirynNodeTestDryRunStore {
  const path = (file: string, kind: MuirSirynNodeTestDryRunKind) =>
    join(dir, `${createHash('sha256').update(file).digest('hex')}.${kind}`);

  return {
    start() {
      muirSirynNodeTestOwnDir(dir);

      // Nothing a reused owner directory holds is from this dry run, and a mutant run would read it as if it were.
      for (const name of readdirSync(dir)) {
        rmSync(join(dir, name), { recursive: true });
      }
    },

    write(file, kind, content) {
      writeFileSync(path(file, kind), content);
    },

    read(file, kind) {
      try {
        return readFileSync(path(file, kind), 'utf8');
      } catch {
        return undefined;
      }
    },
  };
}
