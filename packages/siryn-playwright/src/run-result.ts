import type { FullResult, TestCase } from '@playwright/test/reporter';
import type { MutantCoverage } from '@stryker-mutator/api/core';
import {
  type CompleteDryRunResult,
  determineHitLimitReached,
  type DryRunResult,
  DryRunStatus,
  type ErrorDryRunResult,
  type MutantRunResult,
  type TestResult,
  TestStatus,
  toMutantRunResult,
} from '@stryker-mutator/api/test-runner';

import {
  muirSirynPlaywrightNullPrototypeRecord,
  type MuirSirynPlaywrightSnapshot,
} from './protocol.ts';
import {
  type MuirSirynPlaywrightCollectingReporter,
  muirSirynPlaywrightErrorText,
  type MuirSirynPlaywrightReportedTest,
  type MuirSirynPlaywrightTestWindow,
} from './reporter.ts';
import type {
  MuirSirynPlaywrightDryRunRequest,
  MuirSirynPlaywrightMutantRunRequest,
  MuirSirynPlaywrightRunRequest,
} from './run-request.ts';
import { muirSirynPlaywrightUntaggedArrival } from './server-protocol.ts';
import { muirSirynPlaywrightTimeoutReason } from './timeouts.ts';

export type MuirSirynPlaywrightRunResult =
  | (Omit<CompleteDryRunResult, 'mutantCoverage'> & {
      readonly snapshots: readonly MuirSirynPlaywrightSnapshot[];
    })
  | Exclude<DryRunResult, { readonly status: DryRunStatus.Complete }>;

export type MuirSirynPlaywrightRunStatus = FullResult['status'] | 'deadline';

export interface MuirSirynPlaywrightRunOutput {
  readonly status: MuirSirynPlaywrightRunStatus;
  readonly reporter: MuirSirynPlaywrightCollectingReporter;
  readonly snapshots: readonly MuirSirynPlaywrightSnapshot[];
  readonly hookInstalled: boolean;
  readonly installErrors: readonly string[];
  readonly serverMutants: readonly string[];
}

export interface MuirSirynPlaywrightCoverageGaps {
  readonly lostFrames: number;
  readonly sharedFrames: number;
}

const statusByOutcome: Record<ReturnType<TestCase['outcome']>, TestStatus> = {
  expected: TestStatus.Success,
  flaky: TestStatus.Success,
  unexpected: TestStatus.Failed,
  skipped: TestStatus.Skipped,
};

export interface MuirSirynPlaywrightAttemptSummary {
  /** An attempt ended other than expected, skipped aside: timed out and interrupted count. */
  readonly anyFailed: boolean;
  /**
   * An attempt failed or passed against its expectation. A timed-out, interrupted or skipped attempt
   * kills no mutant; the test a deadline stop interrupts ends as skipped.
   */
  readonly killed: boolean;
  readonly timedOut: boolean;
}

export function muirSirynPlaywrightAttemptSummary(
  testCases: Iterable<MuirSirynPlaywrightReportedTest>,
  failOnFlakyTests: boolean,
): MuirSirynPlaywrightAttemptSummary {
  const attempts = [...testCases]
    // Playwright 1.64.1 passes a run whose tests pass on a retry, unless failOnFlakyTests is set.
    .filter((test) => failOnFlakyTests || test.outcome() !== 'flaky')
    .flatMap((test) =>
      test.results.map(({ status }) => ({
        status,
        unexpected: status !== test.expectedStatus,
      })),
    );

  return {
    anyFailed: attempts.some(
      ({ status, unexpected }) => unexpected && status !== 'skipped',
    ),
    killed: attempts.some(
      ({ status, unexpected }) =>
        unexpected && (status === 'failed' || status === 'passed'),
    ),
    timedOut: attempts.some(({ status }) => status === 'timedOut'),
  };
}

export function muirSirynPlaywrightMayHaveLostItsServer(
  output: MuirSirynPlaywrightRunOutput,
): boolean {
  return (
    output.status !== 'deadline' &&
    muirSirynPlaywrightAttemptSummary(output.reporter.testCases.values(), true)
      .anyFailed
  );
}

export function muirSirynPlaywrightFlakyTestNames(
  output: MuirSirynPlaywrightRunOutput,
): string[] {
  return [...output.reporter.testCases.values()]
    .filter((test) => test.outcome() === 'flaky')
    .map(muirSirynPlaywrightTestName);
}

export function muirSirynPlaywrightToRunResult(
  output: MuirSirynPlaywrightRunOutput,
  request: MuirSirynPlaywrightRunRequest,
): MuirSirynPlaywrightRunResult {
  const { status, reporter, snapshots, hookInstalled, installErrors } = output;
  const { failOnFlakyTests } = reporter;
  const isMutantRun = request.kind === 'mutant';
  const testCases = [...reporter.testCases.values()];
  const tests = testCases.map((test) => toTestResult(test, failOnFlakyTests));
  const { killed, timedOut } = muirSirynPlaywrightAttemptSummary(
    testCases,
    failOnFlakyTests,
  );
  const coveringTestsPassed =
    isMutantRun &&
    allPassed(
      request.selection?.covering,
      reporter.testCases,
      failOnFlakyTests,
    );
  const reason = muirSirynPlaywrightTimeoutReason({
    mutantRun: isMutantRun,
    killed,
    testTimedOut: timedOut,
    stoppedAtDeadline: status === 'deadline',
    coveringTestsPassed,
  });

  if (reporter.retriesNotRaised) {
    return errorRun(reporter.retriesNotRaised);
  }

  if (status === 'interrupted') {
    return errorRun('The Playwright run was interrupted');
  }

  // Before the empty-run rules: a stop during the config load leaves no tests at all.
  if (status === 'deadline' && reason) {
    return { status: DryRunStatus.Timeout, reason };
  }

  if (reporter.errors.length && !anyTestFailed(tests)) {
    return errorRun(reporter.errors.join('\n'));
  }

  // Playwright catches its own internal errors, prints them, and fails the run without reporting them.
  if (status === 'failed' && tests.length === 0) {
    return errorRun(
      'Playwright failed without running a test; rerun Stryker with --logLevel trace to see its error.',
    );
  }

  if (tests.length === 0) {
    return emptyRunResult(request);
  }

  // A worker that dies at the hook's install is to Playwright only a crash; the hook left the cause.
  if (installErrors.length > 0) {
    return errorRun(
      `The Stryker worker hook failed to install in a Playwright worker: ${[...new Set(installErrors)].join('\n')}`,
    );
  }

  if (!hookInstalled && anyRan(tests)) {
    return errorRun(
      'Tests ran but the Stryker worker hook did not install in any Playwright worker; this Playwright version may have changed its worker entry point.',
    );
  }

  if (reason) {
    return { status: DryRunStatus.Timeout, reason };
  }

  return {
    status: DryRunStatus.Complete,
    tests: coveringTestsPassed && !killed ? survivorTests(tests) : tests,
    snapshots,
  };
}

// Stryker counts any Failed test in a Complete result as a kill.
function survivorTests(tests: readonly TestResult[]): TestResult[] {
  return tests.filter((test) => test.status !== TestStatus.Failed);
}

function allPassed(
  ids: readonly string[] | undefined,
  testCases: ReadonlyMap<string, MuirSirynPlaywrightReportedTest>,
  failOnFlakyTests: boolean,
): boolean {
  return (
    ids !== undefined &&
    ids.length > 0 &&
    ids.every((id) => {
      const test = testCases.get(id);

      return (
        test !== undefined &&
        testStatus(test.outcome(), failOnFlakyTests) === TestStatus.Success
      );
    })
  );
}

export function muirSirynPlaywrightMissingCoverageError(
  tests: readonly TestResult[],
  snapshots: readonly MuirSirynPlaywrightSnapshot[],
): string | undefined {
  if (
    !anyRan(tests) ||
    anyTestFailed(tests) ||
    snapshots.some((snapshot) => snapshot.coverage || snapshot.instrumented)
  ) {
    return undefined;
  }

  if (snapshots.length === 0) {
    return 'Tests ran, but no instrumented code ran, neither in a page nor in a Playwright worker. The dry run needs at least one test that runs the app code, in a page or by importing it.';
  }

  const { lostFrames } = muirSirynPlaywrightCoverageGaps(snapshots);

  if (lostFrames === snapshots.length) {
    return `No page reported coverage: all ${lostFrames} frame(s) did not answer before their context closed.`;
  }

  return 'No page loaded instrumented code. Is the webServer serving the Stryker sandbox? A server that was already running (reuseExistingServer) serves the original sources.';
}

export const muirSirynPlaywrightArrivalSlackMs = 50;

/**
 * A server request that came without a test id counts for every test that ran when it arrived, and as
 * static when none did. The output maps have no prototype, so a test id such as __proto__ from a page
 * stays an own key.
 */
export function muirSirynPlaywrightMergeCoverage(
  snapshots: readonly MuirSirynPlaywrightSnapshot[],
  windows: readonly MuirSirynPlaywrightTestWindow[] = [],
): MutantCoverage {
  const merged: MutantCoverage = {
    static: muirSirynPlaywrightNullPrototypeRecord(),
    perTest: muirSirynPlaywrightNullPrototypeRecord(),
  };
  const add = (
    target: Record<string, number>,
    hits: Record<string, number>,
  ) => {
    Object.entries(hits).forEach(([mutantId, count]) => {
      target[mutantId] = (target[mutantId] ?? 0) + count;
    });
  };
  const testsFor = (testId: string, outlivedItsTest: boolean): string[] => {
    const arrivedAt = muirSirynPlaywrightUntaggedArrival(testId);

    if (arrivedAt === undefined) {
      return outlivedItsTest ? [] : [testId];
    }

    return [
      ...new Set(
        windows
          .filter(
            ({ start, end }) =>
              start - muirSirynPlaywrightArrivalSlackMs <= arrivedAt &&
              arrivedAt <= end + muirSirynPlaywrightArrivalSlackMs,
          )
          .map((window) => window.testId),
      ),
    ];
  };

  snapshots.forEach(({ coverage, outlivedItsTest }) => {
    if (!coverage) {
      return;
    }

    add(merged.static, coverage.static);
    Object.entries(coverage.perTest).forEach(([testId, hits]) => {
      const tests = testsFor(testId, outlivedItsTest);

      if (tests.length === 0) {
        add(merged.static, hits);
      }

      tests.forEach((id) => {
        add(
          (merged.perTest[id] ??= muirSirynPlaywrightNullPrototypeRecord()),
          hits,
        );
      });
    });
  });

  return merged;
}

export function muirSirynPlaywrightCoverageGaps(
  snapshots: readonly MuirSirynPlaywrightSnapshot[],
): MuirSirynPlaywrightCoverageGaps {
  return {
    lostFrames: snapshots.filter((snapshot) => snapshot.lost).length,
    sharedFrames: snapshots.filter(
      (snapshot) => snapshot.outlivedItsTest && snapshot.coverage,
    ).length,
  };
}

function sumHitCounts(
  snapshots: readonly MuirSirynPlaywrightSnapshot[],
): number {
  return snapshots.reduce((sum, { hitCount }) => sum + hitCount, 0);
}

export function muirSirynPlaywrightDryRunResult(
  output: MuirSirynPlaywrightRunOutput,
  request: MuirSirynPlaywrightDryRunRequest,
): { result: DryRunResult; gaps: MuirSirynPlaywrightCoverageGaps | undefined } {
  const run = muirSirynPlaywrightToRunResult(output, request);

  if (run.status !== DryRunStatus.Complete) {
    return { result: run, gaps: undefined };
  }

  const { status, tests, snapshots } = run;
  const errorMessage = muirSirynPlaywrightMissingCoverageError(
    tests,
    snapshots,
  );

  if (errorMessage) {
    return { result: errorRun(errorMessage), gaps: undefined };
  }

  if (request.coverageAnalysis === 'off') {
    return { result: { status, tests }, gaps: undefined };
  }

  return {
    result: {
      status,
      tests,
      mutantCoverage: muirSirynPlaywrightMergeCoverage(
        snapshots,
        output.reporter.windows,
      ),
    },
    gaps: muirSirynPlaywrightCoverageGaps(snapshots),
  };
}

export function muirSirynPlaywrightMutantRunResult(
  output: MuirSirynPlaywrightRunOutput,
  request: MuirSirynPlaywrightMutantRunRequest,
): { result: MutantRunResult; hitCount: number } {
  const hitCount = sumHitCounts(output.snapshots);

  return {
    result: toMutantRunResult(
      determineHitLimitReached(hitCount, request.hitLimit) ??
        muirSirynPlaywrightToRunResult(output, request),
    ),
    hitCount,
  };
}

function emptyRunResult(
  request: MuirSirynPlaywrightRunRequest,
): MuirSirynPlaywrightRunResult {
  // Stryker fails an empty dry run itself unless allowEmpty is set.
  if (request.kind === 'dry') {
    return { status: DryRunStatus.Complete, tests: [], snapshots: [] };
  }

  if (request.selection?.toRun.length) {
    return errorRun(
      `None of the ${request.selection.toRun.length} selected tests ran; their Playwright test ids no longer match.`,
    );
  }

  return errorRun('Playwright ran no tests.');
}

function errorRun(errorMessage: string): ErrorDryRunResult {
  return { status: DryRunStatus.Error, errorMessage };
}

function anyRan(tests: readonly TestResult[]): boolean {
  return tests.some((test) => test.status !== TestStatus.Skipped);
}

function anyTestFailed(tests: readonly TestResult[]): boolean {
  return tests.some((test) => test.status === TestStatus.Failed);
}

function testStatus(
  outcome: ReturnType<TestCase['outcome']>,
  failOnFlakyTests: boolean,
): TestStatus {
  return outcome === 'flaky' && failOnFlakyTests
    ? TestStatus.Failed
    : statusByOutcome[outcome];
}

export function muirSirynPlaywrightTestName(
  test: MuirSirynPlaywrightReportedTest,
): string {
  // The root suite's title is the empty first one.
  const [project = '', ...rest] = test.titlePath().filter(Boolean);

  return `[${project}] › ${rest.join(' › ')}`;
}

function toTestResult(
  test: MuirSirynPlaywrightReportedTest,
  failOnFlakyTests: boolean,
): TestResult {
  const last = test.results.at(-1);
  const status = testStatus(test.outcome(), failOnFlakyTests);
  const base = {
    id: test.id,
    name: muirSirynPlaywrightTestName(test),
    timeSpentMs: last?.duration ?? 0,
    fileName: test.location.file,
    startPosition: {
      line: test.location.line - 1,
      column: test.location.column - 1,
    },
  };

  if (status !== TestStatus.Failed) {
    return { ...base, status };
  }

  return {
    ...base,
    status,
    failureMessage: muirSirynPlaywrightErrorText(
      test.results.findLast((result) => result.error)?.error,
    ),
  };
}
