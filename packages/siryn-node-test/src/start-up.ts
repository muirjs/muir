import type { Logger } from '@stryker-mutator/api/logging';

import type { MuirSirynNodeTestDryRunStore } from './dry-run-store.ts';
import { muirSirynNodeTestIsObject } from './guards.ts';
import {
  muirSirynNodeTestNamesFile,
  muirSirynNodeTestOutsideMs,
  muirSirynNodeTestWithin,
  type MuirSirynNodeTestRecordedTest,
} from './record.ts';

/** What a mutant run's deadline needs to know of a test file from the dry run. */
export interface MuirSirynNodeTestStartUp {
  readonly startUpMs: number;
  readonly tests: number;
}

export function muirSirynNodeTestStartUpOf(
  tests: readonly MuirSirynNodeTestRecordedTest[],
  fileMs: number,
): MuirSirynNodeTestStartUp {
  return {
    startUpMs: Math.max(
      0,
      Math.floor(muirSirynNodeTestOutsideMs(tests, fileMs)),
    ),
    tests: tests.length,
  };
}

/**
 * Each test file's start-up from the dry run, kept in the dry-run store that Stryker's own process owns and removes as it
 * exits (see `muirSirynNodeTestOwnDryRun`), so that every worker's mutant runs read what one worker's dry run measured. A worker's
 * runner cannot remove them: Stryker replaces runners while other workers still read them.
 */
export interface MuirSirynNodeTestStartUps {
  record(file: string, startUp: MuirSirynNodeTestStartUp): void;
  deadline(
    files: readonly string[],
    testFilter: readonly string[] | undefined,
    timeout: number,
  ): number;
}

export function muirSirynNodeTestStartUps(
  store: MuirSirynNodeTestDryRunStore,
  timeoutFactor: number,
  log: Logger,
): MuirSirynNodeTestStartUps {
  const unmeasured = new Set<string>();
  const read = (file: string) => {
    const startUp = storedStartUp(store.read(file, 'start-up'));

    if (startUp === undefined && !unmeasured.has(file)) {
      unmeasured.add(file);
      log.warn(
        `The dry run left no readable start-up time for "${file}", so its mutant runs count its start-up once per ` +
          "covering test, as Stryker's own timeout does.",
      );
    }

    return startUp;
  };

  return {
    record(file, startUp) {
      store.write(file, 'start-up', JSON.stringify(startUp));
    },

    deadline(files, testFilter, timeout) {
      return muirSirynNodeTestDeadlineMs(
        timeout,
        timeoutFactor,
        files.flatMap((file) => {
          const startUp = read(file);

          if (startUp === undefined) {
            return [];
          }

          // Stryker runs every test of a file for a static mutant, or without coverage, and then sums the time of
          // every test of the dry run.
          const wholeFile =
            testFilter === undefined ||
            muirSirynNodeTestNamesFile(testFilter, file);

          return [
            {
              covering: wholeFile
                ? startUp.tests
                : testFilter.filter((id) => muirSirynNodeTestWithin(id, file))
                    .length,
              startUpMs: startUp.startUpMs,
            },
          ];
        }),
      );
    },
  };
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function storedStartUp(
  content: string | undefined,
): MuirSirynNodeTestStartUp | undefined {
  if (content === undefined) {
    return undefined;
  }

  try {
    const stored: unknown = JSON.parse(content);

    if (muirSirynNodeTestIsObject(stored)) {
      const { startUpMs, tests } = stored;

      if (isCount(startUpMs) && isCount(tests)) {
        return { startUpMs, tests };
      }
    }
  } catch {
    // Not JSON.
  }

  return undefined;
}

/** A test file of a mutant run: its covering tests and its start-up time from the dry run. */
export interface MuirSirynNodeTestDeadlineFile {
  readonly covering: number;
  readonly startUpMs: number;
}

/**
 * Stryker's `timeout` less `timeoutFactor` times each file's start-up for every covering test after the file's first:
 * Stryker's timeout counts a file's start-up once per covering test, as each test's time holds it, and the run starts
 * the file once. A millisecond of each start-up stays counted, so that what is left never falls below the tests' time
 * and each start-up once, however Stryker rounded each test's time.
 */
export function muirSirynNodeTestDeadlineMs(
  timeout: number,
  timeoutFactor: number,
  files: readonly MuirSirynNodeTestDeadlineFile[],
): number {
  const extraStartUpMs = files.reduce(
    (sum, { covering, startUpMs }) =>
      sum + Math.max(0, covering - 1) * Math.max(0, startUpMs - 1),
    0,
  );

  // Records that this dry run did not write could take off more than the timeout, and AbortSignal.timeout throws below 0.
  return Math.max(1, timeout - timeoutFactor * extraStartUpMs);
}
