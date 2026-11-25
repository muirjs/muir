import type {
  FullConfig,
  TestCase,
  TestError,
  TestResult,
} from '@playwright/test/reporter';

import { muirSirynPlaywrightRaiseRetries } from './playwright-internals.ts';

export interface MuirSirynPlaywrightReportedAttempt {
  readonly status: TestResult['status'];
  readonly startTime?: Date | undefined;
  readonly duration: number;
  readonly error?: TestError | undefined;
  readonly attachments: readonly Pick<
    TestResult['attachments'][number],
    'name' | 'path'
  >[];
}

export interface MuirSirynPlaywrightReportedTest {
  readonly id: string;
  readonly expectedStatus: TestCase['expectedStatus'];
  readonly results: readonly MuirSirynPlaywrightReportedAttempt[];
  readonly location: Readonly<TestCase['location']>;
  readonly parent: unknown;
  titlePath(): string[];
  outcome(): ReturnType<TestCase['outcome']>;
}

export interface MuirSirynPlaywrightReportedSuite {
  allTests(): readonly MuirSirynPlaywrightReportedTest[];
}

export interface MuirSirynPlaywrightTestWindow {
  readonly testId: string;
  readonly start: number;
  readonly end: number;
}

export class MuirSirynPlaywrightCollectingReporter {
  readonly errors: string[] = [];
  retriesNotRaised: string | undefined;
  failOnFlakyTests = false;
  outputTail = '';
  // Playwright reports each attempt of a retried test with the same TestCase, which holds them all.
  readonly testCases = new Map<string, MuirSirynPlaywrightReportedTest>();
  readonly windows: MuirSirynPlaywrightTestWindow[] = [];
  readonly #retriesByProject: ReadonlyMap<string, number>;
  readonly #now: () => number;
  #suite: MuirSirynPlaywrightReportedSuite | undefined;

  constructor(
    retriesByProject: ReadonlyMap<string, number> = new Map(),
    now: () => number = Date.now,
  ) {
    this.#retriesByProject = retriesByProject;
    this.#now = now;
  }

  printsToStdio() {
    return false;
  }

  onBegin(
    { failOnFlakyTests }: Pick<FullConfig, 'failOnFlakyTests'>,
    suite: MuirSirynPlaywrightReportedSuite,
  ) {
    this.failOnFlakyTests = failOnFlakyTests;
    this.#suite = suite;

    if ([...this.#retriesByProject.values()].some(Boolean)) {
      try {
        muirSirynPlaywrightRaiseRetries(suite, this.#retriesByProject);
      } catch (error) {
        this.retriesNotRaised = String(error);
      }
    }
  }

  get listedTests(): readonly MuirSirynPlaywrightReportedTest[] {
    return this.#suite?.allTests() ?? [];
  }

  onTestEnd(test: MuirSirynPlaywrightReportedTest) {
    this.testCases.set(test.id, test);
    const startTime = test.results.at(-1)?.startTime;

    if (startTime !== undefined) {
      this.windows.push({
        testId: test.id,
        start: startTime.getTime(),
        end: this.#now(),
      });
    }
  }

  onStdOut(chunk: string | Buffer) {
    this.outputTail = (this.outputTail + chunk.toString()).slice(-4000);
  }

  onStdErr(chunk: string | Buffer) {
    this.onStdOut(chunk);
  }

  onError(error: TestError) {
    this.errors.push(muirSirynPlaywrightErrorText(error));
  }
}

export function muirSirynPlaywrightErrorText(
  error: TestError | undefined,
): string {
  return error?.message ?? error?.value ?? 'Test failed';
}
