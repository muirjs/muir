import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { isMainThread } from 'node:worker_threads';

import { INSTRUMENTER_CONSTANTS } from '@stryker-mutator/api/core';

import { muirSirynPlaywrightIsRecord } from './is-record.ts';
import {
  muirSirynPlaywrightGlobalNamespace,
  muirSirynPlaywrightMarkInstrumentedReads,
  type MuirSirynPlaywrightStrykerNamespace,
} from './namespace.ts';
import {
  type MuirSirynPlaywrightHookedBrowser,
  type MuirSirynPlaywrightHookedContext,
  type MuirSirynPlaywrightHookedFrame,
  type MuirSirynPlaywrightHookedPage,
  type MuirSirynPlaywrightHookedRequestContext,
  muirSirynPlaywrightInstrumentationOf,
  muirSirynPlaywrightInternalsChanged,
  muirSirynPlaywrightVersion,
  type MuirSirynPlaywrightRunningSlot,
  muirSirynPlaywrightRunningSlotOf,
  type MuirSirynPlaywrightSlotType,
  muirSirynPlaywrightWorkerEntry,
} from './playwright-internals.ts';
import {
  muirSirynPlaywrightFrameReadTimeoutMs,
  muirSirynPlaywrightInstallErrorSuffix,
  type MuirSirynPlaywrightPageSettings,
  muirSirynPlaywrightReadHookTestNamespace,
  muirSirynPlaywrightReadRunSettings,
  type MuirSirynPlaywrightRunSettings,
  muirSirynPlaywrightSerializeSnapshot,
  muirSirynPlaywrightSnapshotSuffix,
  type MuirSirynPlaywrightSnapshotLine,
  muirSirynPlaywrightWorkerFilePrefix,
} from './protocol.ts';
import {
  muirSirynPlaywrightHostKey,
  muirSirynPlaywrightTestIdHeader,
} from './server-protocol.ts';

type FrameRead = Omit<MuirSirynPlaywrightSnapshotLine, 'outlivedItsTest'>;

/** The namespace fields of a value that only passed an object check, such as another frame's or a stored namespace. */
type UncheckedNamespace = Readonly<
  Partial<Record<keyof MuirSirynPlaywrightStrykerNamespace, unknown>>
>;

class ContextState {
  readonly testId: string | undefined;
  readonly #closedPageSnapshots: FrameRead[] = [];
  #collected = false;

  constructor(testId: string | undefined) {
    this.testId = testId;
  }

  keepClosedPage(snapshots: readonly FrameRead[]): void {
    this.#closedPageSnapshots.push(...snapshots);
  }

  collectOnce(): readonly FrameRead[] | undefined {
    if (this.#collected) {
      return undefined;
    }

    this.#collected = true;

    return this.#closedPageSnapshots;
  }
}

interface RunningTest {
  readonly testId: string;
  readonly slot: MuirSirynPlaywrightRunningSlot | undefined;
}

type CurrentTest = () => RunningTest | undefined;

// Playwright's `test` is a function, and playwright/test exports that function as the module itself.
function memberOf(value: unknown, key: string): unknown {
  return typeof value === 'function' || muirSirynPlaywrightIsRecord(value)
    ? Reflect.get(value, key)
    : undefined;
}

/** Reads test.info() of playwright/test's `test`, and parses what it returns. */
function currentTestOf(playwrightTest: unknown, version: string): CurrentTest {
  const test = memberOf(playwrightTest, 'test');
  const info = memberOf(test, 'info');

  if (typeof info !== 'function') {
    throw muirSirynPlaywrightInternalsChanged(
      version,
      'playwright/test test.info(), which tells the worker hook the test that runs',
    );
  }

  return () => {
    let found: unknown;

    try {
      found = info.call(test);
    } catch {
      // test.info() throws while no test runs.
      return undefined;
    }

    if (
      !muirSirynPlaywrightIsRecord(found) ||
      typeof found['testId'] !== 'string'
    ) {
      throw muirSirynPlaywrightInternalsChanged(
        version,
        "playwright/test test.info() returning the running test's testId",
      );
    }

    return {
      testId: found['testId'],
      slot: muirSirynPlaywrightRunningSlotOf(found, version),
    };
  };
}

// Undefined under `node -e`, which a worker's NODE_OPTIONS can reach.
const entry = process.argv[1];
const settings = muirSirynPlaywrightReadRunSettings(process.env);
// `Symbol.for`, so a second copy of this package in the worker, from another install, sees the mark
// of the first and leaves the worker's coverage to it.
const installed: unique symbol = Symbol.for(
  '@muirjs/siryn-playwright/worker-hook',
);

if (
  settings &&
  isMainThread &&
  entry !== undefined &&
  muirSirynPlaywrightWorkerEntry.test(entry) &&
  !(installed in globalThis)
) {
  Reflect.set(globalThis, installed, installed);

  try {
    muirSirynPlaywrightInstall(
      createRequire(entry),
      settings,
      muirSirynPlaywrightReadHookTestNamespace(process.env),
    );
  } catch (error) {
    try {
      fs.writeFileSync(
        path.join(
          settings.outDir,
          `${muirSirynPlaywrightWorkerFilePrefix}${process.pid}${muirSirynPlaywrightInstallErrorSuffix}`,
        ),
        String(error),
      );
    } catch {
      // The worker still exits with the install error; the run then reports only a crashed worker.
    }

    throw error;
  }
}

export function muirSirynPlaywrightInstall(
  playwrightRequire: (id: string) => unknown,
  {
    outDir,
    perTest,
    hitLimit,
    testIdHosts,
    pageHelpers,
  }: MuirSirynPlaywrightRunSettings,
  ns: string,
): void {
  const tagHosts = perTest ? testIdHosts : undefined;
  const version = muirSirynPlaywrightVersion(playwrightRequire);
  const test = currentTestOf(playwrightRequire('playwright/test'), version);
  const owningTest = () => owningTestId(test);
  const instrumentation = muirSirynPlaywrightInstrumentationOf(
    playwrightRequire('playwright-core'),
    version,
  );
  const activeMutant =
    process.env[INSTRUMENTER_CONSTANTS.ACTIVE_MUTANT_ENV_VARIABLE];
  const outFile = path.join(
    outDir,
    `${muirSirynPlaywrightWorkerFilePrefix}${process.pid}-${randomUUID()}${muirSirynPlaywrightSnapshotSuffix}`,
  );
  const contexts = new WeakMap<
    MuirSirynPlaywrightHookedContext,
    ContextState
  >();
  const alreadyRead = new WeakSet<MuirSirynPlaywrightHookedPage>();
  const patchedBrowsers = new WeakSet<MuirSirynPlaywrightHookedBrowser>();

  fs.writeFileSync(outFile, '');
  muirSirynPlaywrightRecordNodeCoverage(
    muirSirynPlaywrightGlobalNamespace(ns),
    { perTest, hitLimit },
    () => nodeTestId(test),
    (line) => fs.appendFileSync(outFile, line + '\n'),
  );

  // Closing a page that owns its context closes the context first, so the same page can come up twice.
  function readOnce(
    pages: MuirSirynPlaywrightHookedPage[],
  ): Promise<FrameRead[]> {
    const fresh = pages.filter((page) => !alreadyRead.has(page));
    fresh.forEach((page) => alreadyRead.add(page));

    return readPages(fresh, ns);
  }

  async function collect(context: MuirSirynPlaywrightHookedContext) {
    const state = contexts.get(context);
    const closedPageSnapshots = state?.collectOnce();

    if (!state || !closedPageSnapshots) {
      return;
    }

    const snapshots = [
      ...closedPageSnapshots,
      ...(await readOnce(context.pages())),
    ];
    const outlivedItsTest =
      perTest && (state.testId === undefined || state.testId !== owningTest());
    const lines = snapshots.map((snapshot) =>
      muirSirynPlaywrightSerializeSnapshot({ ...snapshot, outlivedItsTest }),
    );

    if (lines.length) {
      fs.appendFileSync(outFile, lines.join('\n') + '\n');
    }
  }

  // browser.close(), and page.close() on a page whose context stays open, skip the before-close hook for
  // what they close, so read first.
  function collectBeforePageCloses(
    state: ContextState,
    page: MuirSirynPlaywrightHookedPage,
  ) {
    const close = page.close.bind(page);
    page.close = async (options) => {
      state.keepClosedPage(await readOnce([page]));

      return close(options);
    };
  }

  function collectBeforeBrowserCloses(
    browser: MuirSirynPlaywrightHookedBrowser | null,
  ) {
    if (!browser || patchedBrowsers.has(browser)) {
      return;
    }

    patchedBrowsers.add(browser);
    const close = browser.close.bind(browser);
    browser.close = async (options) => {
      await Promise.all(browser.contexts().map(collect));

      return close(options);
    };
  }

  instrumentation.addListener({
    async runAfterCreateBrowserContext(context) {
      const state = new ContextState(perTest ? owningTest() : undefined);
      contexts.set(context, state);
      collectBeforeBrowserCloses(context.browser());
      context.on('page', (page) => collectBeforePageCloses(state, page));

      // First, so the helpers' header reads the active mutant before initPage marks such reads.
      if (pageHelpers !== undefined) {
        await context.addInitScript({ content: pageHelpers });
      }

      await context.addInitScript(muirSirynPlaywrightInitPage, {
        ns,
        activeMutant,
        testId: state.testId,
        hitLimit,
      } satisfies MuirSirynPlaywrightPageSettings);

      if (tagHosts !== undefined) {
        await tagPageRequests(context, owningTest, tagHosts);
      }
    },
    runBeforeCloseBrowserContext: collect,
    async runAfterCreateRequestContext(context) {
      if (tagHosts !== undefined) {
        tagFetches(context, owningTest);
      }
    },
  });
}

/**
 * Adds the header after the browser decided on CORS, and only to the webServer's hosts, so a cross-origin
 * request gets no preflight it would not get without the runner. `fallback` leaves the request to the
 * routes the test adds, which Playwright runs first.
 */
function tagPageRequests(
  context: MuirSirynPlaywrightHookedContext,
  currentTestId: () => string | undefined,
  hosts: readonly string[],
) {
  return context.route(
    (url) => hosts.includes(muirSirynPlaywrightHostKey(url)),
    (route) => {
      const testId = currentTestId();

      if (testId === undefined) {
        return route.fallback();
      }

      return route.fallback({
        headers: {
          ...route.request().headers(),
          [muirSirynPlaywrightTestIdHeader]: testId,
        },
      });
    },
  );
}

/**
 * Wraps fetch, which get, post and the other methods call. Playwright Test's listener fills a request
 * context's options only where they are unset, after this hook's listener (playwright 1.64.1
 * lib/index.js:128), so setting extraHTTPHeaders at creation would drop the test's own.
 */
function tagFetches(
  context: MuirSirynPlaywrightHookedRequestContext,
  currentTestId: () => string | undefined,
) {
  const fetch = context.fetch.bind(context);
  const tagged: MuirSirynPlaywrightHookedRequestContext['fetch'] = (
    target,
    options = {},
  ) => {
    const testId = currentTestId();

    if (testId === undefined) {
      return fetch(target, options);
    }

    return fetch(target, {
      ...options,
      headers: {
        ...(options.headers ??
          (typeof target === 'string' ? {} : target.headers())),
        [muirSirynPlaywrightTestIdHeader]: testId,
      },
    });
  };
  Object.defineProperty(context, 'fetch', {
    configurable: true,
    writable: true,
    value: tagged,
  });
}

export function muirSirynPlaywrightRecordNodeCoverage(
  ns: MuirSirynPlaywrightStrykerNamespace,
  {
    perTest,
    hitLimit,
  }: Pick<MuirSirynPlaywrightRunSettings, 'perTest' | 'hitLimit'>,
  currentTestId: () => string | undefined,
  write: (line: string) => void,
  onExit: (listener: () => void) => void = (listener) => {
    process.on('exit', listener);
  },
): void {
  let written = false;
  const writeOnce = () => {
    if (written) {
      return;
    }

    written = true;

    // After a failure that reaches maxFailures the runner may have read and removed the run's
    // directory already. A throw in an exit listener keeps Playwright's worker from exiting until
    // its 5-minute force-kill, so a write with nowhere to go is dropped.
    try {
      write(
        muirSirynPlaywrightSerializeSnapshot({
          mutantCoverage: ns.mutantCoverage,
          hitCount: ns.hitCount,
          outlivedItsTest: false,
          instrumented: ns.instrumented,
        }),
      );
    } catch {
      // Dropped, as above.
    }
  };

  muirSirynPlaywrightMarkInstrumentedReads(ns);

  if (hitLimit !== undefined) {
    let hits = 0;
    ns.hitLimit = hitLimit;
    Object.defineProperty(ns, 'hitCount', {
      get: () => hits,
      set: (value: number) => {
        hits = value;

        if (hits > hitLimit) {
          writeOnce();
        }
      },
    });
  }

  if (perTest) {
    Object.defineProperty(ns, 'currentTestId', { get: currentTestId });
  }

  onExit(() => {
    if (ns.mutantCoverage === undefined && !ns.hitCount && !ns.instrumented) {
      return;
    }

    writeOnce();
  });
}

// Playwright makes a test current before it runs the beforeAll hooks and sets up the fixtures it
// needs, so test.info() alone names the first test of a group for code that serves the whole group.
// Fixtures differ between the two rules: Node code cannot tell a worker fixture from a test's own, so
// it counts for no test, while a context a fixture opens is checked again at close (outlivedItsTest).
const perTestSlots: ReadonlySet<MuirSirynPlaywrightSlotType> = new Set([
  'test',
  'beforeEach',
  'afterEach',
]);
const groupHooks: ReadonlySet<MuirSirynPlaywrightSlotType> = new Set([
  'beforeAll',
  'afterAll',
]);

/** The test that Node code running now belongs to: none in a beforeAll or afterAll hook or a fixture. */
function nodeTestId(test: CurrentTest): string | undefined {
  const running = test();

  if (running === undefined) {
    return undefined;
  }

  const { slot } = running;

  return slot && !slot.inFixture && perTestSlots.has(slot.type)
    ? running.testId
    : undefined;
}

/**
 * The test that a browser context, or a request it sends, belongs to now: none in a beforeAll or afterAll
 * hook. Unlike nodeTestId, a fixture, a worker fixture included, counts for the current test; collect checks
 * at close whether the context outlived that test.
 */
function owningTestId(test: CurrentTest): string | undefined {
  const running = test();
  const type = running?.slot?.type;

  return type !== undefined && groupHooks.has(type)
    ? undefined
    : running?.testId;
}

async function readPages(
  pages: MuirSirynPlaywrightHookedPage[],
  ns: string,
): Promise<FrameRead[]> {
  const snapshots = await Promise.all(
    pages
      .flatMap((page) => page.frames())
      .map((frame) => readNamespace(frame, ns)),
  );

  return snapshots.filter((snapshot) => snapshot !== undefined);
}

async function readNamespace(
  frame: MuirSirynPlaywrightHookedFrame,
  ns: string,
): Promise<FrameRead | undefined> {
  const { promise: lost, resolve } = Promise.withResolvers<FrameRead>();
  const timer = setTimeout(
    () => resolve({ lost: true }),
    muirSirynPlaywrightFrameReadTimeoutMs,
  );
  const read = frame
    // Reaches the page as source text, like initPage.
    .evaluate((name) => {
      const scope: Record<string, unknown> = globalThis;
      const found = scope[name];

      if (typeof found !== 'object' || found === null) {
        return undefined;
      }

      const { mutantCoverage, hitCount, instrumented }: UncheckedNamespace =
        found;

      return { mutantCoverage, hitCount, instrumented };
    }, ns)
    .then(frameRead)
    .catch(() =>
      frame.isDetached() ? undefined : ({ lost: true } satisfies FrameRead),
    );

  try {
    return await Promise.race([read, lost]);
  } finally {
    clearTimeout(timer);
  }
}

function frameRead(value: unknown): FrameRead | undefined {
  return muirSirynPlaywrightIsRecord(value)
    ? {
        mutantCoverage: value['mutantCoverage'],
        hitCount: value['hitCount'],
        instrumented: value['instrumented'],
      }
    : undefined;
}

// Reaches the page as source text, where an instrumented copy calls Stryker's per-file helper functions
// (`stryNS_`, `stryCov_`, `stryMutAct_`), which the page lacks: mutating it is safe only while no test in the
// Stryker run opens a real page.
export function muirSirynPlaywrightInitPage({
  ns,
  activeMutant,
  testId,
  hitLimit,
}: MuirSirynPlaywrightPageSettings): void {
  const scope: Record<string, unknown> = globalThis;
  const found = scope[ns];
  const s: MuirSirynPlaywrightStrykerNamespace =
    typeof found === 'object' && found !== null ? found : (scope[ns] = {});
  const key = `${ns}:carry`;

  if (activeMutant !== undefined) {
    s.activeMutant = activeMutant;
  } else {
    let value = s.activeMutant;
    delete s.instrumented;
    Object.defineProperty(s, 'activeMutant', {
      configurable: true,
      get: () => {
        s.instrumented = true;

        return value;
      },
      set: (next: unknown) => {
        value = next;
      },
    });
  }

  if (hitLimit !== undefined) {
    s.hitLimit = hitLimit;
    s.hitCount = 0;
  }

  if (testId !== undefined) {
    s.currentTestId = testId;
  }

  if (window.top !== window) {
    return;
  }

  try {
    const carried: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');

    if (typeof carried === 'object' && carried !== null) {
      const { mutantCoverage, hitCount, instrumented }: UncheckedNamespace =
        carried;
      s.mutantCoverage = mutantCoverage;

      if (instrumented === true) {
        s.instrumented = true;
      }

      if (hitLimit !== undefined) {
        s.hitCount = hitCount ?? 0;
      }
    }

    addEventListener('pagehide', () => {
      sessionStorage.setItem(
        key,
        JSON.stringify({
          mutantCoverage: s.mutantCoverage,
          hitCount: s.hitCount,
          instrumented: s.instrumented,
        }),
      );
    });
  } catch {
    // Opaque origins (about:blank, data: URLs) have no sessionStorage.
  }
}
