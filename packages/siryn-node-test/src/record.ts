import { randomUUID } from 'node:crypto';
import { renameSync, writeFileSync } from 'node:fs';

import type { MutantCoverage, Position } from '@stryker-mutator/api/core';

import {
  muirSirynNodeTestIsNumber,
  muirSirynNodeTestIsObject,
  muirSirynNodeTestIsString,
  muirSirynNodeTestIsStrings,
  muirSirynNodeTestOptional,
} from './guards.ts';

export function muirSirynNodeTestTestId(parent: string, name: string): string {
  return `${parent} > ${/(^| )>( |$)/.test(name) ? name.replace(/[\\>]/g, '\\$&') : name}`;
}

export function muirSirynNodeTestAfterHookId(testFile: string): string {
  return muirSirynNodeTestTestId(testFile, '"after" hook');
}

/** node:test reports in declaration order, so the wrapper and the reporter number alike. */
export function muirSirynNodeTestUniqueIds(): (
  parent: string,
  name: string,
) => string {
  const used = new Set<string>();

  return (parent, name) => {
    const base = muirSirynNodeTestTestId(parent, name);

    let id = base;

    for (let count = 2; used.has(id); count++) {
      id = `${base} (${count})`;
    }

    used.add(id);

    return id;
  };
}

export function muirSirynNodeTestWithin(id: string, scope: string): boolean {
  return id === scope || id.startsWith(`${scope} > `);
}

/**
 * Whether `testFilter` names the test file itself. Stryker does that only for a mutant that runs every test of the
 * file, as a static mutant under --testFiles does.
 */
export function muirSirynNodeTestNamesFile(
  testFilter: readonly string[] | undefined,
  file: string,
): boolean {
  return testFilter?.includes(file) === true;
}

export type MuirSirynNodeTestRecordedTest = {
  readonly id: string;
  readonly timeSpentMs: number;
  readonly startPosition?: Position;
} & (
  | { readonly status: 'failed'; readonly failureMessage?: string }
  /** Skipped tests include todo tests, which run but whose outcome node:test ignores. */
  | {
      readonly status: 'passed' | 'skipped';
      readonly failureMessage?: undefined;
    }
);

/** The time a file's run, `fileMs`, spent outside its outermost tests, whose time includes their subtests'. */
export function muirSirynNodeTestOutsideMs(
  tests: readonly MuirSirynNodeTestRecordedTest[],
  fileMs: number,
): number {
  const outermost = tests.filter(
    (test) =>
      !tests.some(
        (other) => other !== test && muirSirynNodeTestWithin(test.id, other.id),
      ),
  );

  return fileMs - outermost.reduce((sum, test) => sum + test.timeSpentMs, 0);
}

/**
 * A span of time in milliseconds on the machine's monotonic clock, as `process.hrtime` reads it: it does not step, and
 * every process and thread of the machine reads the same clock, which the wall clock and `performance.timeOrigin` do
 * not to the millisecond.
 */
export interface MuirSirynNodeTestTimeWindow {
  readonly start: number;
  readonly end: number;
}

interface MemoryLimitReached {
  readonly rssMB: number;
  readonly limitMB: number;
}

export interface MuirSirynNodeTestProcessRecord {
  readonly main?: true;
  readonly tests: readonly MuirSirynNodeTestRecordedTest[];
  // undefined: the record goes through JSON.stringify, which leaves such a field out.
  readonly hitCount?: number | undefined;
  readonly mutantCoverage?: MutantCoverage | undefined;
  readonly peakMemoryMB?: number | undefined;
  readonly memoryLimitReached?: MemoryLimitReached;
  readonly diagnostics?: readonly string[];
  /**
   * Set when the test file's process exited before node:test's summary through process.exit() or an uncaught
   * exception, which skip `beforeExit`, unless the hook ended it once node:test had reported every top-level suite and
   * test.
   */
  readonly unfinished?: true;
  /** What kept the test file's process alive after its tests and root `after` hooks, when the hook ended it for that. */
  readonly heldOpen?: readonly string[];
  /**
   * Set when the hook ended a mutant run's test file whose event loop had emptied with a test still pending, and which
   * no test result followed for this many milliseconds.
   */
  readonly stalledMs?: number;
  /** From when the hook ran in the process or thread to when it wrote this record. */
  readonly lifetime?: MuirSirynNodeTestTimeWindow;
  /**
   * The test file's own record: by test id, the spans during which the test is current, so a process or thread started
   * then reads it as its current test. A span ends when another test becomes current; a pause in which no test is
   * current between two spans of one test joins them.
   */
  readonly testSpans?: Readonly<
    Record<string, readonly MuirSirynNodeTestTimeWindow[]>
  >;
}

export const muirSirynNodeTestEnvNames = Object.freeze({
  out: 'MUIR_SIRYN_NODE_TEST_OUT',
  file: 'MUIR_SIRYN_NODE_TEST_FILE',
  dryRun: 'MUIR_SIRYN_NODE_TEST_DRY_RUN',
  hitLimit: 'MUIR_SIRYN_NODE_TEST_HIT_LIMIT',
  memoryLimit: 'MUIR_SIRYN_NODE_TEST_MEMORY_LIMIT_MB',
  current: 'MUIR_SIRYN_NODE_TEST_CURRENT',
  filter: 'MUIR_SIRYN_NODE_TEST_FILTER',
  bail: 'MUIR_SIRYN_NODE_TEST_BAIL',
  activeMutant: 'MUIR_SIRYN_NODE_TEST_ACTIVE_MUTANT',
  heldOpen: 'MUIR_SIRYN_NODE_TEST_HELD_OPEN_MS',
  stall: 'MUIR_SIRYN_NODE_TEST_STALL_MS',
  dryRunOwner: 'MUIR_SIRYN_NODE_TEST_DRY_RUN_OWNER',
  runner: 'MUIR_SIRYN_NODE_TEST_RUNNER_PID',
});

/**
 * How long a test file's process may stay alive after its tests and root `after` hooks when the ending does not end it
 * at once for a failed test. The runner's own tests shorten it through envNames.heldOpen, which the runner never
 * passes on from its environment; it is not an option.
 */
export const muirSirynNodeTestHeldOpenMs = 30_000;

/** Stryker's variable for the active mutant, which instrumented code reads when it loads. */
export const muirSirynNodeTestActiveMutantEnv = '__STRYKER_ACTIVE_MUTANT__';

/** Tells apart the records of processes that had the same pid, as a pid can come back within one file run. */
export function muirSirynNodeTestRecordNonce(): string {
  return randomUUID();
}

export function muirSirynNodeTestRecordName(
  pid: number,
  threadId: number,
  nonce: string,
): string {
  return `${pid}.${threadId}.${nonce}.json`;
}

/** The record the memory watchdog writes when it ends its process. */
export function muirSirynNodeTestMemoryRecordName(
  pid: number,
  nonce: string,
): string {
  return `${pid}.${nonce}.memory.json`;
}

/** Where a record is written before it is renamed to `path`, so that a reader finds every record whole. */
export function muirSirynNodeTestTempRecordPath(path: string): string {
  return `${path}.tmp`;
}

/** What `muirSirynNodeTestWriteRecord` takes from the process. */
export interface MuirSirynNodeTestRecordFiles {
  readonly write: (path: string, data: string) => void;
  readonly rename: (from: string, to: string) => void;
  /** Blocks the thread for `ms`: a record is written in exit listeners, which run no timer. */
  readonly pause: (ms: number) => void;
  readonly platform: NodeJS.Platform;
}

export const muirSirynNodeTestRecordFiles: MuirSirynNodeTestRecordFiles = {
  write: writeFileSync,
  rename: renameSync,
  pause: (ms) => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  },
  platform: process.platform,
};

/**
 * How often, and how far apart, `muirSirynNodeTestWriteRecord` renames on Windows, where a rename over a file that another process has
 * open, as the runner reading the record or a virus scanner the new temporary file, fails with EPERM or EBUSY: at most
 * 40 ms in all.
 */
const renameAttempts = 5;
const renameRetryMs = 10;

function isBusy(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'EPERM' || error.code === 'EBUSY')
  );
}

/**
 * Writes `record` to `muirSirynNodeTestTempRecordPath(path)` and renames that over `path`, so that a reader finds the record whole, and
 * a kill during the write leaves the one before.
 */
export function muirSirynNodeTestWriteRecord(
  path: string,
  record: MuirSirynNodeTestProcessRecord,
  files: MuirSirynNodeTestRecordFiles = muirSirynNodeTestRecordFiles,
): void {
  const temp = muirSirynNodeTestTempRecordPath(path);
  files.write(temp, JSON.stringify(record));

  for (let attempt = 1; ; attempt++) {
    try {
      files.rename(temp, path);

      return;
    } catch (error) {
      if (
        files.platform !== 'win32' ||
        attempt === renameAttempts ||
        !isBusy(error)
      ) {
        throw error;
      }
    }

    files.pause(renameRetryMs);
  }
}

/** What the name of a record says about the process or thread that wrote it. */
export interface MuirSirynNodeTestRecordName {
  readonly pid: number;
  /** The id of the thread that wrote the record, or `memory` for the record the memory watchdog writes. */
  readonly thread: number | 'memory';
  readonly nonce: string;
}

const threadRecordPattern =
  /^(?<pid>\d+)\.(?<thread>\d+)\.(?<nonce>[\da-f-]+)\.json$/;
const memoryRecordPattern = /^(?<pid>\d+)\.(?<nonce>[\da-f-]+)\.memory\.json$/;

/** The parts of a record's name, as `recordName` and `memoryRecordName` put them together; undefined for another name. */
export function muirSirynNodeTestParseRecordName(
  name: string,
): MuirSirynNodeTestRecordName | undefined {
  const { pid, thread, nonce } = threadRecordPattern.exec(name)?.groups ?? {};

  if (nonce !== undefined) {
    return { pid: Number(pid), thread: Number(thread), nonce };
  }

  const { pid: memoryPid, nonce: memoryNonce } =
    memoryRecordPattern.exec(name)?.groups ?? {};

  return memoryNonce === undefined
    ? undefined
    : { pid: Number(memoryPid), thread: 'memory', nonce: memoryNonce };
}

/** Whether `name` is the name of a record, which a record's temporary file is not. */
export function muirSirynNodeTestIsRecordName(name: string): boolean {
  return muirSirynNodeTestParseRecordName(name) !== undefined;
}

function notARecord(field?: string): never {
  const message = 'not a record of test results';

  throw new Error(field === undefined ? message : `${message}: ${field}`);
}

const isTrue = (value: unknown) => value === true;
const isCounts = (value: unknown) =>
  muirSirynNodeTestIsObject(value) &&
  Object.values(value).every(muirSirynNodeTestIsNumber);
const isPosition = (value: unknown): value is Position =>
  muirSirynNodeTestIsObject(value) &&
  muirSirynNodeTestIsNumber(value['line']) &&
  muirSirynNodeTestIsNumber(value['column']);
const isMemoryLimit = (value: unknown): value is MemoryLimitReached =>
  muirSirynNodeTestIsObject(value) &&
  muirSirynNodeTestIsNumber(value['rssMB']) &&
  muirSirynNodeTestIsNumber(value['limitMB']);
const isWindow = (value: unknown): value is MuirSirynNodeTestTimeWindow =>
  muirSirynNodeTestIsObject(value) &&
  muirSirynNodeTestIsNumber(value['start']) &&
  muirSirynNodeTestIsNumber(value['end']);
const isSpans = (
  value: unknown,
): value is Record<string, MuirSirynNodeTestTimeWindow[]> =>
  muirSirynNodeTestIsObject(value) &&
  Object.values(value).every(
    (spans) => Array.isArray(spans) && spans.every(isWindow),
  );
const isCoverage = (value: unknown): value is MutantCoverage =>
  muirSirynNodeTestIsObject(value) &&
  isCounts(value['static']) &&
  muirSirynNodeTestIsObject(value['perTest']) &&
  Object.values(value['perTest']).every(isCounts);

function parseTest(
  value: unknown,
  path: string,
): MuirSirynNodeTestRecordedTest {
  if (!muirSirynNodeTestIsObject(value)) {
    notARecord(path);
  }

  const { id, status, failureMessage, timeSpentMs, startPosition } = value;

  if (!muirSirynNodeTestIsString(id)) {
    notARecord(`${path}.id`);
  }

  if (status !== 'passed' && status !== 'failed' && status !== 'skipped') {
    notARecord(`${path}.status`);
  }

  if (!muirSirynNodeTestIsNumber(timeSpentMs)) {
    notARecord(`${path}.timeSpentMs`);
  }

  const base = {
    id,
    timeSpentMs,
    ...muirSirynNodeTestOptional(
      'startPosition',
      startPosition,
      isPosition,
      notARecord,
      `${path}.startPosition`,
    ),
  };

  if (status === 'failed') {
    return {
      ...base,
      status,
      ...muirSirynNodeTestOptional(
        'failureMessage',
        failureMessage,
        muirSirynNodeTestIsString,
        notARecord,
        `${path}.failureMessage`,
      ),
    };
  }

  if (failureMessage !== undefined) {
    notARecord(`${path}.failureMessage`);
  }

  return { ...base, status };
}

export function muirSirynNodeTestParseRecord(
  json: string,
): MuirSirynNodeTestProcessRecord {
  const record: unknown = JSON.parse(json);

  if (!muirSirynNodeTestIsObject(record)) {
    notARecord();
  }

  const {
    tests,
    main,
    hitCount,
    mutantCoverage,
    peakMemoryMB,
    memoryLimitReached,
    diagnostics,
    unfinished,
    heldOpen,
    stalledMs,
    lifetime,
    testSpans,
  } = record;

  if (!Array.isArray(tests)) {
    notARecord('tests');
  }

  return {
    tests: tests.map((test, index) => parseTest(test, `tests[${index}]`)),
    ...muirSirynNodeTestOptional('main', main, isTrue, notARecord),
    ...muirSirynNodeTestOptional(
      'hitCount',
      hitCount,
      muirSirynNodeTestIsNumber,
      notARecord,
    ),
    ...muirSirynNodeTestOptional(
      'mutantCoverage',
      mutantCoverage,
      isCoverage,
      notARecord,
    ),
    ...muirSirynNodeTestOptional(
      'peakMemoryMB',
      peakMemoryMB,
      muirSirynNodeTestIsNumber,
      notARecord,
    ),
    ...muirSirynNodeTestOptional(
      'memoryLimitReached',
      memoryLimitReached,
      isMemoryLimit,
      notARecord,
    ),
    ...muirSirynNodeTestOptional(
      'diagnostics',
      diagnostics,
      muirSirynNodeTestIsStrings,
      notARecord,
    ),
    ...muirSirynNodeTestOptional('unfinished', unfinished, isTrue, notARecord),
    ...muirSirynNodeTestOptional(
      'heldOpen',
      heldOpen,
      muirSirynNodeTestIsStrings,
      notARecord,
    ),
    ...muirSirynNodeTestOptional(
      'stalledMs',
      stalledMs,
      muirSirynNodeTestIsNumber,
      notARecord,
    ),
    ...muirSirynNodeTestOptional('lifetime', lifetime, isWindow, notARecord),
    ...muirSirynNodeTestOptional('testSpans', testSpans, isSpans, notARecord),
  };
}
