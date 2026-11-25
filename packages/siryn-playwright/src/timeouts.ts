import { muirSirynPlaywrightFrameReadTimeoutMs } from './protocol.ts';

// Config load and worker start before the first test, measured at about 2.7 s.
export const muirSirynPlaywrightRunStartMs = 3000;
// A deadline stop measured 2078-2096 ms in 8 of 9 runs: the hung frame's read plus context close and worker exit.
export const muirSirynPlaywrightStopHeadroomMs =
  muirSirynPlaywrightFrameReadTimeoutMs + 600;
export const muirSirynPlaywrightMinTestTimeoutMs = 2000;
export const muirSirynPlaywrightStopRetryMs = 100;
// Playwright's default expect.timeout.
export const muirSirynPlaywrightDefaultExpectTimeoutMs = 5000;

export interface MuirSirynPlaywrightConfigTimeouts {
  readonly testTimeoutCap: number;
  readonly expectTimeout: number;
}

export function muirSirynPlaywrightConfigTimeouts(
  projects: readonly {
    expect?: { timeout?: number | undefined } | undefined;
    project: { timeout: number };
  }[],
): MuirSirynPlaywrightConfigTimeouts {
  if (projects.length === 0) {
    return {
      testTimeoutCap: Infinity,
      expectTimeout: muirSirynPlaywrightDefaultExpectTimeoutMs,
    };
  }

  const timeouts = projects.map(({ project }) => project.timeout);
  const expectTimeouts = projects.map(
    ({ expect }) =>
      expect?.timeout ?? muirSirynPlaywrightDefaultExpectTimeoutMs,
  );

  return {
    testTimeoutCap: timeouts.includes(0) ? Infinity : Math.max(...timeouts),
    expectTimeout: Math.max(...expectTimeouts),
  };
}

// A project's suite is titled with its name, which Playwright lets projects share.
export function muirSirynPlaywrightConfigRetries(
  projects: readonly { project: { name: string; retries: number } }[],
  optionRetries: number | undefined,
): ReadonlyMap<string, number> {
  const retriesByProject = new Map<string, number>();

  projects.forEach(({ project: { name, retries } }) => {
    const resolved = optionRetries ?? retries;
    const named = retriesByProject.get(name);

    if (named !== undefined && named !== resolved) {
      throw new Error(
        `The Playwright projects named ${JSON.stringify(name)} set different retries (${named} and ${resolved}), and the runner tells projects apart by name. Give them distinct names, or set muirSirynPlaywright.retries.`,
      );
    }

    retriesByProject.set(name, resolved);
  });

  return retriesByProject;
}

export function muirSirynPlaywrightAssertionTimeoutWarning(
  config: MuirSirynPlaywrightConfigTimeouts,
  strykerTimeoutMS: number,
  retries: number,
): string | undefined {
  const attempts = retries + 1;
  // Stryker's measured overhead (dry run time less test time) shrinks to 0 when Playwright workers overlap tests.
  // Playwright 1.64.1's dispatcher stops the worker after a failed test, so each retry starts a new one.
  const attemptMs = config.expectTimeout + muirSirynPlaywrightRunStartMs;
  const lowerBoundMs = attempts * attemptMs + muirSirynPlaywrightStopHeadroomMs;

  if (strykerTimeoutMS >= lowerBoundMs) {
    return undefined;
  }

  // A failed first attempt kills the mutant, even when the deadline stops its retries.
  const consequences = [
    ...(strykerTimeoutMS < attemptMs + muirSirynPlaywrightStopHeadroomMs
      ? ['killed mutants may be reported as timeouts']
      : []),
    ...(retries > 0
      ? [
          "a failed test's retries may not finish, so a flaky test can kill a mutant",
        ]
      : []),
  ];

  return `timeoutMS (${strykerTimeoutMS}) is below ${attempts} attempt(s) at the Playwright expect timeout (${config.expectTimeout}) plus ${muirSirynPlaywrightRunStartMs} ms to start a worker for each, and ${muirSirynPlaywrightStopHeadroomMs} ms to stop the run; ${consequences.join(', and ')}. Set timeoutMS to at least ${lowerBoundMs}.`;
}

export interface MuirSirynPlaywrightRunBudget {
  readonly testTimeout: number | undefined;
  readonly deadlineMs: number | undefined;
}

export const muirSirynPlaywrightDryRunBudget: MuirSirynPlaywrightRunBudget = {
  testTimeout: undefined,
  deadlineMs: undefined,
};

export function muirSirynPlaywrightMutantRunBudget(
  strykerTimeout: number,
  config: MuirSirynPlaywrightConfigTimeouts,
): MuirSirynPlaywrightRunBudget {
  const deadlineMs = strykerTimeout - muirSirynPlaywrightStopHeadroomMs;
  const testRoomMs = deadlineMs - muirSirynPlaywrightRunStartMs;

  return {
    testTimeout: Math.min(
      Math.max(testRoomMs, muirSirynPlaywrightMinTestTimeoutMs),
      config.testTimeoutCap,
    ),
    deadlineMs:
      testRoomMs < muirSirynPlaywrightMinTestTimeoutMs ? undefined : deadlineMs,
  };
}

export interface MuirSirynPlaywrightTimeoutFacts {
  readonly mutantRun: boolean;
  readonly killed: boolean;
  readonly testTimedOut: boolean;
  readonly stoppedAtDeadline: boolean;
  readonly coveringTestsPassed: boolean;
}

export function muirSirynPlaywrightTimeoutReason(
  facts: MuirSirynPlaywrightTimeoutFacts,
): string | undefined {
  if (facts.killed || facts.coveringTestsPassed) {
    return undefined;
  }

  if (facts.stoppedAtDeadline) {
    return "The run reached the runner's deadline before Stryker's timeout";
  }

  return facts.mutantRun && facts.testTimedOut
    ? 'A test hit its timeout'
    : undefined;
}

export interface MuirSirynPlaywrightArmedDeadline {
  readonly firedAt: number | undefined;
  disarm(): void;
}

// setTimeout fires at once for a longer delay.
const maxTimerDelayMs = 2 ** 31 - 1;

// Playwright's stopTests() does nothing while runTests is still loading the config, and a second call
// is harmless.
export function muirSirynPlaywrightArmDeadline(
  at: number | undefined,
  stop: () => Promise<void>,
  now: () => number = () => performance.now(),
): MuirSirynPlaywrightArmedDeadline {
  if (at === undefined) {
    return { firedAt: undefined, disarm: () => undefined };
  }

  let firedAt: number | undefined;
  let retry: NodeJS.Timeout | undefined;
  const call = () => void stop().catch(() => undefined);
  const timer = setTimeout(
    () => {
      firedAt = now();
      call();
      retry = setInterval(call, muirSirynPlaywrightStopRetryMs);
    },
    Math.min(Math.max(0, at - now()), maxTimerDelayMs),
  );

  return {
    get firedAt() {
      return firedAt;
    },
    disarm() {
      clearTimeout(timer);
      clearInterval(retry);
    },
  };
}
